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
        
        // Update navigation UI
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

    // Clean up any remaining HTML, head, or body tags
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
                /* Reset default styles */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                /* Add your extracted styles */
                ${style}
            </style>
        </head>
        <body>
            ${mainHtml}
            <script>
                // Wrap in try-catch to prevent errors from breaking the preview
                try {
                    ${script}
                } catch (error) {
                    console.error('Preview script error:', error);
                }
            </script>
        </body>
        </html>
    `;

    const previewFrame = document.getElementById('preview-frame');
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
}

function updateImageUploadStatus() {
    const count = uploadedImages.length;
    imageStatus.textContent = count ? `${count} image${count > 1 ? 's' : ''} selected` : '';
}

generateBtn.addEventListener('click', () => generateWebsite(aiPrompt.value));
modifyBtn.addEventListener('click', () => generateWebsite(modifyPrompt.value, true));
downloadBtn.addEventListener('click', downloadWebsite);

referenceImages.addEventListener('change', handleImageUpload);

providerSelect.addEventListener('change', () => {
    const provider = providerSelect.value;
    const imageUploadContainer = document.querySelector('.image-upload-container');
    const isSupported = provider === 'google' || provider === 'openai'|| 
    (provider === 'groq' && (model.includes('vision') || model.includes('llava')));
  
    
    imageUploadContainer.classList.toggle('disabled', !isSupported);
    referenceImages.disabled = !isSupported;
    if (provider === 'groq') {
        referenceImages.setAttribute('multiple', '');
        if (uploadedImages.length > 1) {
          uploadedImages = [uploadedImages[0]];
          updateImagePreviews();
          updateImageUploadStatus();
        }
      } else {
        referenceImages.setAttribute('multiple', 'multiple');
      }
});

modelSelect.addEventListener('change', () => {
  const provider = providerSelect.value;
  const model = modelSelect.value;
  const imageUploadContainer = document.querySelector('.image-upload-container');
  
  if (provider === 'groq') {
    const isVisionModel = model.includes('vision') || model.includes('llava');
    imageUploadContainer.classList.toggle('disabled', !isVisionModel);
    referenceImages.disabled = !isVisionModel;
    
    if (!isVisionModel) {
      uploadedImages = [];
      updateImagePreviews();
      updateImageUploadStatus();
    }
  }
});

document.addEventListener('paste', async (event) => {
    const provider = providerSelect.value;
    const model = modelSelect.value;
    const isSupported = provider === 'google' || provider === 'openai' || 
        (provider === 'groq' && (model.includes('vision') || model.includes('llava')));
    
    if (!isSupported) return;

    const items = event.clipboardData.items;
    let imageFile = null;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            imageFile = items[i].getAsFile();
            break;
        }
    }

    if (imageFile) {
        const file = new File([imageFile], `pasted-image-${Date.now()}.png`, {
            type: imageFile.type
        });

        if (provider === 'groq') {
            uploadedImages = [file];
        } else {
            uploadedImages.push(file);
        }

        updateImagePreviews();
        updateImageUploadStatus();

        showNotification('Image pasted successfully!');
    }
});

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'paste-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function updateVersionNavigation() {
const previewHeader = document.querySelector('.preview-header');
    
    const existingNav = previewHeader.querySelector('.version-navigation');
    if (existingNav) {
        existingNav.remove();
    }

    const navigation = document.createElement('div');
    navigation.className = 'version-navigation';
    navigation.innerHTML = `
        <button class="nav-btn prev-btn" title="Previous Version (←)">←</button>
        <span class="version-info"></span>
        <button class="nav-btn next-btn" title="Next Version (→)">→</button>
    `;
    
    const viewControls = previewHeader.querySelector('.view-controls');
    previewHeader.insertBefore(navigation, viewControls);
    
    navigation.querySelector('.prev-btn').addEventListener('click', () => navigateVersion(-1));
    navigation.querySelector('.next-btn').addEventListener('click', () => navigateVersion(1));
    
    updateVersionInfo();
}

function updateVersionInfo() {
    const versionInfo = document.querySelector('.version-info');
    if (versionHistory.length > 0) {
        versionInfo.textContent = `Version ${currentVersionIndex + 1} of ${versionHistory.length}`;
    } else {
        versionInfo.textContent = 'No versions';
    }
    
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    prevBtn.disabled = currentVersionIndex <= 0;
    nextBtn.disabled = currentVersionIndex >= versionHistory.length - 1;
}

function navigateVersion(delta) {
    const newIndex = currentVersionIndex + delta;
    if (newIndex >= 0 && newIndex < versionHistory.length) {
        currentVersionIndex = newIndex;
        const version = versionHistory[currentVersionIndex];
        updatePreview(version.code);
        updateVersionInfo();
    }
}

document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'TEXTAREA') return; 
    
    if (event.key === 'ArrowLeft') {
        navigateVersion(-1);
    } else if (event.key === 'ArrowRight') {
        navigateVersion(1);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const codeElement = codeView.querySelector('code');
    codeElement.contentEditable = 'true';
    codeElement.spellcheck = false;
});

function updateCodeView(html) {
    const codeElement = codeView.querySelector('code');
    if (!codeElement.contentEditable) {
        codeElement.contentEditable = 'true';
        codeElement.spellcheck = false;
    }
    
    
    const formattedCode = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/(".*?")/g, '<span class="string">$1</span>')
        .replace(/(&lt;\/?[a-z]+(&gt;)?)/g, '<span class="keyword">$1</span>')
        .replace(/(\/\*.*?\*\/|\/\/.*$)/gm, '<span class="comment">$1</span>');
    
    codeElement.innerHTML = formattedCode;
}

function executeCode() {
    const codeElement = codeView.querySelector('code');
    const code = codeElement.innerText
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    
    updatePreview(code);
    previewToggle.click();
}

previewToggle.addEventListener('click', () => {
    previewToggle.classList.add('active');
    codeToggle.classList.remove('active');
    previewFrame.classList.add('active');
    codeView.classList.remove('active');
});

codeToggle.addEventListener('click', () => {
    codeToggle.classList.add('active');
    previewToggle.classList.remove('active');
    codeView.classList.add('active');
    previewFrame.classList.remove('active');
});

const executeButton = document.getElementById('execute-code');
executeButton.addEventListener('click', executeCode);

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'b') {
        if (previewFrame.classList.contains('active')) {
            codeToggle.click();
        } else {
            previewToggle.click();
        }
    }

    if (e.ctrlKey && e.key === 'Enter') {
        executeCode();
    }
});
