const aiPrompt = document.getElementById('ai-prompt');
const generateBtn = document.getElementById('generate-btn');
const modifyPrompt = document.getElementById('modify-prompt');
const modifyBtn = document.getElementById('modify-btn');
const previewFrame = document.getElementById('preview-frame');
const loading = document.getElementById('loading');
const providerSelect = document.getElementById('provider-select');
const modelSelect = document.getElementById('model-select');
const downloadBtn = document.getElementById('download-btn');
const referenceImages = document.getElementById('reference-images');
const imagesPreviewContainer = document.getElementById('images-preview-container');
const imageStatus = document.getElementById('image-status');
const previewToggle = document.getElementById('preview-toggle');
const codeToggle = document.getElementById('code-toggle');
const codeView = document.getElementById('code-view');

let currentWebsiteCode = '';
let models = [];
let uploadedImages = [];
let versionHistory = [];
let currentVersionIndex = -1;

async function fetchModels() {
    const response = await fetch('/models');
    models = await response.json();
    updateModelSelect();
}

function updateModelSelect() {
    const provider = providerSelect.value;
    modelSelect.innerHTML = '';
    if (models[provider]) {
        models[provider].forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    } else {
        console.error(`No models found for provider: ${provider}`);
    }
}

providerSelect.addEventListener('change', updateModelSelect);

fetchModels();

async function generateWebsite(prompt, isModify = false) {
    loading.classList.remove('hidden');
    generateBtn.disabled = true;
    modifyBtn.disabled = true;

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('provider', providerSelect.value);
    formData.append('model', modelSelect.value);

    if (isModify) {
        formData.append('currentCode', currentWebsiteCode);
    }

    uploadedImages.forEach(file => {
        formData.append('images', file);
    });

    try {
        const response = await fetch(isModify ? '/modify' : '/generate', {
            method: 'POST',
            body: formData
        });

        const reader = response.body.getReader();
        let accumulatedHtml = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');
            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    if (data.text) {
                        let cleanedText = cleanGeneratedCode(data.text);
                        accumulatedHtml += cleanedText;
                        updatePreview(accumulatedHtml);
                    }
                }
            });
        }

        currentWebsiteCode = accumulatedHtml;
        
        versionHistory.push({
            code: accumulatedHtml,
            timestamp: new Date(),
            prompt: prompt
        });
        currentVersionIndex = versionHistory.length - 1;
        
        updateVersionNavigation();
    } catch (error) {
        console.error('Error:', error);
    } finally {
        loading.classList.add('hidden');
        generateBtn.disabled = false;
        modifyBtn.disabled = false;
    }
}

function cleanGeneratedCode(code) {
    code = code.replace(/```\w*\n?/g, '');
    code = code.replace(/<lang="[^"]*">/g, '');
    code = code.trim();
    code = code.replace(/<style>\s*{/g, '<style>');
    code = code.replace(/}\s*<\/style>/g, '</style>');
    return code;
}

function updatePreview(html) {
    html = html.replace(/```html|```css|```javascript|```/g, '');
    let style = '';
    let script = '';
    let mainHtml = html;

    const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatches) {
        styleMatches.forEach(match => {
            style += match.replace(/<\/?style[^>]*>/g, '') + '\n';
            mainHtml = mainHtml.replace(match, '');
        });
    }

    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
        scriptMatches.forEach(match => {
            script += match.replace(/<\/?script[^>]*>/g, '') + '\n';
            mainHtml = mainHtml.replace(match, '');
        });
    }

    mainHtml = mainHtml.replace(/^\s*<html[^>]*>|<\/html>\s*$/gi, '');
    mainHtml = mainHtml.replace(/^\s*<body[^>]*>|<\/body>\s*$/gi, '');
    mainHtml = mainHtml.replace(/^\s*<head[^>]*>|<\/head>\s*$/gi, '');
    mainHtml = mainHtml.replace(/^html/i, '');

    const previewContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                ${style}
            </style>
        </head>
        <body>
            ${mainHtml}
            <script>
                try {
                    ${script}
                } catch (error) {
                    console.error('Preview script error:', error);
                }
            </script>
        </body>
        </html>
    `;

    previewFrame.srcdoc = previewContent;
    updateCodeView(html);
}

async function downloadWebsite() {
    const zip = new JSZip();
    let htmlContent = currentWebsiteCode;
    
    let style = '';
    const styleMatch = htmlContent.match(/<style>([\s\S]*?)<\/style>/i);
    if (styleMatch) {
        style = styleMatch[1];
        htmlContent = htmlContent.replace(styleMatch[0], '');
    }
    
    let script = '';
    const scriptMatch = htmlContent.match(/<script>([\s\S]*?)<\/script>/i);
    if (scriptMatch) {
        script = scriptMatch[1];
        htmlContent = htmlContent.replace(scriptMatch[0], '');
    }
    
    htmlContent = htmlContent
        .replace(/^\s*<html[^>]*>|<\/html>\s*$/gi, '')
        .replace(/^\s*<body[^>]*>|<\/body>\s*$/gi, '')
        .replace(/^\s*<head[^>]*>|<\/head>\s*$/gi, '')
        .replace(/^html/i, '')
        .replace(/^\s+|\s+$/g, '');

    const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Website</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    ${htmlContent}
    <script src="script.js"></script>
</body>
</html>`;
    
    zip.file("index.html", finalHtml);
    
    if (style) {
        zip.file("styles.css", style.trim());
    }
    
    if (script) {
        zip.file("script.js", script.trim());
    }
    
    const content = await zip.generateAsync({type: "blob"});
    
    const prompt = aiPrompt.value.trim();
    const filename = prompt.split(' ').slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'my-website';
    
    saveAs(content, `${filename}.zip`);
}

function handleImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    if (providerSelect.value === 'groq') {
        uploadedImages = [files[0]];
    } else {
        uploadedImages = Array.from(files);
    }
    updateImagePreviews();
    updateImageUploadStatus();
    
    showNotification(`${files.length} image${files.length > 1 ? 's' : ''} uploaded successfully!`);
}

function updateImagePreviews() {
    imagesPreviewContainer.innerHTML = '';
    
    uploadedImages.forEach((file, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-preview-wrapper';

        const img = document.createElement('img');
        img.className = 'image-preview-item';
        img.src = URL.createObjectURL(file);
        img.alt = `Preview ${index + 1}`;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => removeImage(index);

        wrapper.appendChild(img);
        wrapper.appendChild(removeBtn);
        imagesPreviewContainer.appendChild(wrapper);
    });

    imagesPreviewContainer.classList.toggle('hidden', uploadedImages.length === 0);
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    updateImagePreviews();
    updateImageUploadStatus();
    showNotification('Image removed!');
}

function updateImageUploadStatus() {
    imageStatus.innerHTML = `${uploadedImages.length} image${uploadedImages.length !== 1 ? 's' : ''} selected`;
}

generateBtn.addEventListener('click', () => generateWebsite(aiPrompt.value));
modifyBtn.addEventListener('click', () => generateWebsite(modifyPrompt.value, true));
downloadBtn.addEventListener('click', downloadWebsite);
referenceImages.addEventListener('change', handleImageUpload);

previewToggle.addEventListener('click', () => {
    previewToggle.classList.add('active');
    codeToggle.classList.remove('active');
    previewFrame.classList.remove('hidden');
    codeView.classList.add('hidden');
});

codeToggle.addEventListener('click', () => {
    codeToggle.classList.add('active');
    previewToggle.classList.remove('active');
    previewFrame.classList.add('hidden');
    codeView.classList.remove('hidden');
});

function updateCodeView(code) {
    codeView.textContent = code;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => notification.classList.remove('show'), 3000);
    setTimeout(() => document.body.removeChild(notification), 4000);
}

function updateVersionNavigation() {
    document.getElementById('version-navigation').textContent = `Version ${currentVersionIndex + 1} of ${versionHistory.length}`;
}

document.getElementById('undo-btn').addEventListener('click', () => {
    if (currentVersionIndex > 0) {
        currentVersionIndex -= 1;
        currentWebsiteCode = versionHistory[currentVersionIndex].code;
        updatePreview(currentWebsiteCode);
        updateVersionNavigation();
    }
});

document.getElementById('redo-btn').addEventListener('click', () => {
    if (currentVersionIndex < versionHistory.length - 1) {
        currentVersionIndex += 1;
        currentWebsiteCode = versionHistory[currentVersionIndex].code;
        updatePreview(currentWebsiteCode);
        updateVersionNavigation();
    }
});
