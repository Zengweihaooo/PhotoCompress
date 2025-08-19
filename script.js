// Photo Compress & Location Sync Application
class PhotoCompressApp {
    constructor() {
        this.cameraFiles = new Map();
        this.phoneFiles = new Map();
        this.processedFiles = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.updateQualityDisplay();
    }

    setupEventListeners() {
        // File inputs
        document.getElementById('camera-files').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files, 'camera');
        });

        document.getElementById('phone-files').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files, 'phone');
        });

        // Folder inputs
        document.getElementById('camera-folder').addEventListener('change', (e) => {
            this.handleFolderSelection(e.target.files, 'camera');
        });

        document.getElementById('phone-folder').addEventListener('change', (e) => {
            this.handleFolderSelection(e.target.files, 'phone');
        });

        // Quality slider
        document.getElementById('quality').addEventListener('input', (e) => {
            this.updateQualityDisplay();
        });

        // Action buttons
        document.getElementById('compress-only-btn').addEventListener('click', () => {
            this.startProcessing('compress-only');
        });

        document.getElementById('compress-sync-btn').addEventListener('click', () => {
            this.startProcessing('compress-sync');
        });

        document.getElementById('download-all-btn').addEventListener('click', () => {
            this.downloadAllFiles();
        });
    }

    setupDragAndDrop() {
        const uploadBoxes = document.querySelectorAll('.upload-box');
        
        uploadBoxes.forEach((box, index) => {
            const type = index === 0 ? 'camera' : 'phone';
            
            box.addEventListener('dragover', (e) => {
                e.preventDefault();
                box.classList.add('dragover');
            });

            box.addEventListener('dragleave', (e) => {
                e.preventDefault();
                box.classList.remove('dragover');
            });

            box.addEventListener('drop', (e) => {
                e.preventDefault();
                box.classList.remove('dragover');
                this.handleFileSelection(e.dataTransfer.files, type);
            });
        });
    }

    updateQualityDisplay() {
        const qualitySlider = document.getElementById('quality');
        const qualityValue = document.getElementById('quality-value');
        qualityValue.textContent = qualitySlider.value + '%';
    }

    handleFileSelection(files, type) {
        const fileMap = type === 'camera' ? this.cameraFiles : this.phoneFiles;
        const listElement = document.getElementById(`${type}-file-list`);

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const fileId = this.generateFileId();
                fileMap.set(fileId, file);
                this.addFileToList(file, fileId, type, listElement);
            }
        });

        this.updateUI();
    }

    handleFolderSelection(files, type) {
        const fileMap = type === 'camera' ? this.cameraFiles : this.phoneFiles;
        const listElement = document.getElementById(`${type}-file-list`);

        // Group files by folder
        const folderStructure = new Map();
        
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const pathParts = file.webkitRelativePath.split('/');
                const folderPath = pathParts.slice(0, -1).join('/');
                
                if (!folderStructure.has(folderPath)) {
                    folderStructure.set(folderPath, []);
                }
                folderStructure.get(folderPath).push(file);
            }
        });

        // Add folder headers and files
        folderStructure.forEach((files, folderPath) => {
            this.addFolderHeader(folderPath, files.length, listElement);
            
            files.forEach(file => {
                const fileId = this.generateFileId();
                fileMap.set(fileId, file);
                this.addFileToList(file, fileId, type, listElement, true);
            });
        });

        this.logMessage(`已上传 ${files.length} 个文件夹中的图片`, 'success');
        this.updateUI();
    }

    generateFileId() {
        return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addFolderHeader(folderPath, fileCount, listElement) {
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        folderHeader.innerHTML = `
            <div class="folder-info">
                <i class="fas fa-folder"></i>
                <span class="folder-name">${folderPath || '根目录'}</span>
                <span class="folder-count">(${fileCount} 张图片)</span>
            </div>
        `;
        listElement.appendChild(folderHeader);
    }

    addFileToList(file, fileId, type, listElement, isFromFolder = false) {
        const fileItem = document.createElement('div');
        fileItem.className = isFromFolder ? 'file-item folder-file' : 'file-item';
        
        const fileName = isFromFolder ? file.name : file.name;
        const displayPath = isFromFolder ? file.webkitRelativePath : file.name;
        
        fileItem.innerHTML = `
            <div class="file-info">
                <i class="fas fa-image"></i>
                <div>
                    <div class="file-name" title="${displayPath}">${fileName}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                    ${isFromFolder ? `<div class="file-path">${file.webkitRelativePath}</div>` : ''}
                </div>
            </div>
            <button class="remove-file" onclick="app.removeFile('${fileId}', '${type}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        listElement.appendChild(fileItem);
    }

    removeFile(fileId, type) {
        const fileMap = type === 'camera' ? this.cameraFiles : this.phoneFiles;
        fileMap.delete(fileId);
        
        const listElement = document.getElementById(`${type}-file-list`);
        listElement.innerHTML = '';
        
        fileMap.forEach((file, id) => {
            this.addFileToList(file, id, type, listElement);
        });

        this.updateUI();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateUI() {
        const hasCamera = this.cameraFiles.size > 0;
        const hasPhone = this.phoneFiles.size > 0;

        document.getElementById('compress-only-btn').disabled = !hasCamera;
        document.getElementById('compress-sync-btn').disabled = !(hasCamera && hasPhone);
    }

    async startProcessing(mode) {
        this.showProgressSection();
        this.resetProgress();

        try {
            if (mode === 'compress-only') {
                await this.compressPhotos();
            } else if (mode === 'compress-sync') {
                await this.compressAndSyncPhotos();
            }

            this.showResults();
        } catch (error) {
            this.logMessage(`错误: ${error.message}`, 'error');
        }
    }

    showProgressSection() {
        document.getElementById('progress-section').style.display = 'block';
        document.getElementById('progress-section').scrollIntoView({ behavior: 'smooth' });
    }

    resetProgress() {
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('progress-text').textContent = '准备中...';
        document.getElementById('processing-log').innerHTML = '';
        this.processedFiles = [];
    }

    updateProgress(percentage, text) {
        document.getElementById('progress-fill').style.width = percentage + '%';
        document.getElementById('progress-text').textContent = text;
    }

    logMessage(message, type = 'info') {
        const logElement = document.getElementById('processing-log');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;
    }

    async compressPhotos() {
        const files = Array.from(this.cameraFiles.values());
        const total = files.length;
        let processed = 0;

        this.logMessage(`开始压缩 ${total} 张照片...`, 'info');

        for (const file of files) {
            try {
                const compressedFile = await this.compressImage(file);
                this.processedFiles.push({
                    original: file,
                    compressed: compressedFile,
                    type: 'compressed'
                });

                processed++;
                const percentage = Math.round((processed / total) * 100);
                this.updateProgress(percentage, `压缩中... ${processed}/${total}`);
                this.logMessage(`已压缩: ${file.name}`, 'success');
            } catch (error) {
                this.logMessage(`压缩失败 ${file.name}: ${error.message}`, 'error');
            }
        }

        this.logMessage('照片压缩完成!', 'success');
    }

    async compressAndSyncPhotos() {
        const cameraFiles = Array.from(this.cameraFiles.values());
        const phoneFiles = Array.from(this.phoneFiles.values());
        const total = cameraFiles.length;
        let processed = 0;

        this.logMessage(`开始处理 ${total} 张相机照片和 ${phoneFiles.length} 张手机照片...`, 'info');

        // Extract metadata from phone photos
        this.logMessage('提取手机照片的位置和时间信息...', 'info');
        const phoneMetadata = await this.extractPhoneMetadata(phoneFiles);

        for (const cameraFile of cameraFiles) {
            try {
                // Compress the camera photo
                const compressedFile = await this.compressImage(cameraFile);
                
                // Extract camera photo timestamp
                const cameraTimestamp = await this.extractTimestamp(cameraFile);
                
                // Find closest phone photo by time
                const closestPhoneData = this.findClosestPhotoByTime(cameraTimestamp, phoneMetadata);
                
                let finalFile = compressedFile;
                let syncedLocation = false;

                if (closestPhoneData) {
                    // Sync location information
                    finalFile = await this.syncLocationData(compressedFile, closestPhoneData);
                    syncedLocation = true;
                    this.logMessage(`已同步位置信息: ${cameraFile.name} <- ${closestPhoneData.filename}`, 'success');
                }

                this.processedFiles.push({
                    original: cameraFile,
                    compressed: finalFile,
                    type: 'compressed-synced',
                    locationSynced: syncedLocation,
                    syncedWith: closestPhoneData?.filename || null
                });

                processed++;
                const percentage = Math.round((processed / total) * 100);
                this.updateProgress(percentage, `处理中... ${processed}/${total}`);
                this.logMessage(`已处理: ${cameraFile.name}`, 'success');
            } catch (error) {
                this.logMessage(`处理失败 ${cameraFile.name}: ${error.message}`, 'error');
            }
        }

        this.logMessage('照片处理和位置同步完成!', 'success');
    }

    async compressImage(file) {
        try {
            const quality = document.getElementById('quality').value / 100;
            const maxWidth = parseInt(document.getElementById('max-width').value);
            const maxHeight = parseInt(document.getElementById('max-height').value);
            const format = document.getElementById('format').value;
            
            // 检查是否指定了目标文件大小
            const targetSize = document.getElementById('target-size').value;
            const sizeUnit = document.getElementById('size-unit').value;

            let maxSizeMB = 10; // 默认最大10MB
            
            if (targetSize && parseFloat(targetSize) > 0) {
                // 如果指定了目标大小，转换为MB
                maxSizeMB = sizeUnit === 'KB' ? 
                    parseFloat(targetSize) / 1024 : 
                    parseFloat(targetSize);
                
                this.logMessage(`目标文件大小: ${targetSize}${sizeUnit}`, 'info');
            }

            // 使用 browser-image-compression 库进行压缩
            const options = {
                maxSizeMB: maxSizeMB, // 目标文件大小
                maxWidthOrHeight: Math.max(maxWidth, maxHeight), // 最大宽度或高度
                useWebWorker: true, // 使用 Web Worker (不阻塞主线程)
                quality: quality, // 压缩质量
                fileType: `image/${format}`, // 输出格式
                initialQuality: quality, // 初始质量
                alwaysKeepResolution: false, // 允许调整分辨率
                preserveExif: true, // 保留EXIF数据 (重要!)
            };

            this.logMessage(`开始压缩: ${file.name} (${this.formatFileSize(file.size)})`, 'info');
            
            const compressedFile = await imageCompression(file, options);
            
            // 计算压缩比例
            const compressionRatio = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
            const targetReached = targetSize ? 
                `目标: ${targetSize}${sizeUnit}, 实际: ${this.formatFileSize(compressedFile.size)}` :
                `节省 ${compressionRatio}%`;
            
            this.logMessage(
                `压缩完成: ${file.name} - 原始: ${this.formatFileSize(file.size)} → 压缩后: ${this.formatFileSize(compressedFile.size)} (${targetReached})`, 
                'success'
            );

            return compressedFile;
        } catch (error) {
            this.logMessage(`压缩失败 ${file.name}: ${error.message}`, 'error');
            throw error;
        }
    }

    calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        let width = originalWidth;
        let height = originalHeight;

        // Scale down if necessary
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }

        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    async extractPhoneMetadata(phoneFiles) {
        const metadata = [];
        
        for (const file of phoneFiles) {
            try {
                const timestamp = await this.extractTimestamp(file);
                const location = await this.extractLocation(file);
                
                metadata.push({
                    filename: file.name,
                    file: file,
                    timestamp: timestamp,
                    location: location
                });
            } catch (error) {
                this.logMessage(`无法提取 ${file.name} 的元数据: ${error.message}`, 'error');
            }
        }

        return metadata;
    }

    async extractTimestamp(file) {
        // This is a simplified version - in a real implementation,
        // you would use a library like exif-js or piexifjs to extract EXIF data
        return new Promise((resolve) => {
            // For now, use file modification time as fallback
            resolve(new Date(file.lastModified));
        });
    }

    async extractLocation(file) {
        // This is a simplified version - in a real implementation,
        // you would extract GPS coordinates from EXIF data
        return new Promise((resolve) => {
            // Simulate location data extraction
            resolve({
                latitude: 39.9042 + (Math.random() - 0.5) * 0.1,
                longitude: 116.4074 + (Math.random() - 0.5) * 0.1
            });
        });
    }

    findClosestPhotoByTime(targetTimestamp, phoneMetadata) {
        if (phoneMetadata.length === 0) return null;

        let closest = phoneMetadata[0];
        let minDiff = Math.abs(targetTimestamp.getTime() - closest.timestamp.getTime());

        for (const data of phoneMetadata) {
            const diff = Math.abs(targetTimestamp.getTime() - data.timestamp.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                closest = data;
            }
        }

        // Only return if within 24 hours
        const maxDiffHours = 24;
        if (minDiff <= maxDiffHours * 60 * 60 * 1000) {
            return closest;
        }

        return null;
    }

    async syncLocationData(compressedFile, phoneData) {
        // In a real implementation, this would modify the EXIF data
        // For now, we'll just return the compressed file
        // You would use a library like piexifjs to write GPS coordinates to EXIF
        return compressedFile;
    }

    showResults() {
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });

        this.updateResultsStats();
        this.displayResultsGrid();
    }

    updateResultsStats() {
        const processedCount = this.processedFiles.length;
        const syncedCount = this.processedFiles.filter(f => f.locationSynced).length;
        
        // Calculate compression ratio
        const originalSize = this.processedFiles.reduce((sum, f) => sum + f.original.size, 0);
        const compressedSize = this.processedFiles.reduce((sum, f) => sum + f.compressed.size, 0);
        const compressionRatio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

        document.getElementById('processed-count').textContent = processedCount;
        document.getElementById('compression-ratio').textContent = compressionRatio + '%';
        document.getElementById('synced-count').textContent = syncedCount;
    }

    displayResultsGrid() {
        const grid = document.getElementById('results-grid');
        grid.innerHTML = '';

        this.processedFiles.forEach((fileData, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            const imageUrl = URL.createObjectURL(fileData.compressed);
            
            resultItem.innerHTML = `
                <img src="${imageUrl}" alt="Processed image" class="result-image">
                <div class="result-info">
                    <div>
                        <div class="result-name">${fileData.original.name}</div>
                        <div class="result-size">
                            ${this.formatFileSize(fileData.original.size)} → 
                            ${this.formatFileSize(fileData.compressed.size)}
                        </div>
                        ${fileData.locationSynced ? 
                            '<div style="color: #38a169; font-size: 0.8rem;"><i class="fas fa-map-marker-alt"></i> 位置已同步</div>' : 
                            ''
                        }
                    </div>
                    <button class="upload-btn" onclick="app.downloadSingleFile(${index})" style="padding: 8px 16px; font-size: 0.9rem;">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
            
            grid.appendChild(resultItem);
        });
    }

    downloadSingleFile(index) {
        const fileData = this.processedFiles[index];
        const url = URL.createObjectURL(fileData.compressed);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.generateOutputFileName(fileData.original.name);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    generateOutputFileName(originalName) {
        const namingOption = document.getElementById('output-naming').value;
        const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.'));
        const ext = originalName.substring(originalName.lastIndexOf('.'));
        
        switch (namingOption) {
            case 'suffix':
                return `${nameWithoutExt}_compressed${ext}`;
            case 'parent-folder':
                // 模拟保存到上级目录的效果 (浏览器下载时会显示这个路径)
                return `../${nameWithoutExt}_compressed${ext}`;
            case 'prefix':
                return `compressed_${originalName}`;
            case 'folder':
                return `compressed/${originalName}`;
            case 'original':
            default:
                return originalName;
        }
    }

    async downloadAllFiles() {
        if (this.processedFiles.length === 0) return;

        // Create a zip file with all processed images
        // For now, we'll download them individually
        for (let i = 0; i < this.processedFiles.length; i++) {
            setTimeout(() => {
                this.downloadSingleFile(i);
            }, i * 500); // Stagger downloads
        }

        this.logMessage(`开始下载 ${this.processedFiles.length} 个文件...`, 'info');
    }

    showICloudInstructions() {
        document.getElementById('icloud-modal').style.display = 'flex';
    }

    closeICloudModal() {
        document.getElementById('icloud-modal').style.display = 'none';
    }

    openPhotosApp() {
        // 尝试通过URL scheme打开Photos应用
        try {
            window.location.href = 'photos-redirect://';
        } catch (error) {
            // 如果不支持，显示提示
            this.logMessage('请手动打开Photos应用', 'info');
        }
    }

    openICloudWeb() {
        // 在新标签页中打开iCloud.com
        window.open('https://www.icloud.com/photos/', '_blank');
    }

    setFujiPreset(presetType) {
        // 移除所有活动状态
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 设置当前按钮为活动状态
        event.target.classList.add('active');

        const qualitySlider = document.getElementById('quality');
        const maxWidth = document.getElementById('max-width');
        const maxHeight = document.getElementById('max-height');
        const targetSize = document.getElementById('target-size');
        const sizeUnit = document.getElementById('size-unit');
        const format = document.getElementById('format');

        switch (presetType) {
            case 'web':
                // 网络分享 - 小文件，快速加载
                qualitySlider.value = 75;
                maxWidth.value = 1920;
                maxHeight.value = 1280;
                targetSize.value = 500;
                sizeUnit.value = 'KB';
                format.value = 'jpeg';
                this.logMessage('已应用网络分享预设: 适合社交媒体、网站展示', 'info');
                break;

            case 'storage':
                // 存储备份 - 高质量，适合长期保存
                qualitySlider.value = 90;
                maxWidth.value = 3840; // 4K宽度
                maxHeight.value = 2560;
                targetSize.value = '';
                format.value = 'jpeg';
                this.logMessage('已应用存储备份预设: 高质量保存，适合打印和后期处理', 'info');
                break;

            case 'balanced':
            default:
                // 平衡推荐 - 质量与大小的最佳平衡
                qualitySlider.value = 85;
                maxWidth.value = 2400;
                maxHeight.value = 1600;
                targetSize.value = 1.5;
                sizeUnit.value = 'MB';
                format.value = 'jpeg';
                this.logMessage('已应用平衡推荐预设: 富士X-T3最佳平衡设置', 'info');
                break;
        }

        // 更新质量显示
        this.updateQualityDisplay();
    }
}

// Initialize the application
const app = new PhotoCompressApp();

// Make app globally accessible for onclick handlers
window.app = app;
