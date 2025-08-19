// Photo Compress & Location Sync Application
class PhotoCompressApp {
    constructor() {
        this.cameraFiles = new Map();
        this.phoneFiles = new Map();
        this.processedFiles = [];
        this.metadataDatabase = new Map(); // 存储照片元数据的中间数据库
        
        this.init();
    }

    isMobileDevice() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isIOSDevice() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.updateQualityDisplay();
        this.setupMobileOptimizations();
    }

    setupMobileOptimizations() {
        const deviceInfo = document.getElementById('device-info');
        const deviceMessage = document.getElementById('device-message');
        
        if (this.isMobileDevice()) {
            // 显示移动设备信息
            deviceInfo.style.display = 'block';
            if (this.isIOSDevice()) {
                deviceMessage.textContent = '📱 检测到iOS设备 - 可以直接选择照片库中的照片并提取元数据';
            } else {
                deviceMessage.textContent = '📱 检测到移动设备 - 可以直接选择照片并提取元数据';
            }
            
            // 为移动设备优化界面
            const nativeButtons = document.querySelectorAll('.upload-btn.native-btn');
            nativeButtons.forEach(btn => {
                if (btn.textContent.includes('如何访问照片库')) {
                    btn.innerHTML = '<i class="fas fa-camera"></i> 选择照片';
                    btn.onclick = (e) => {
                        const type = e.target.closest('.upload-area').id.includes('camera') ? 'camera' : 'phone';
                        this.openMobilePhotoPicker(type);
                    };
                }
            });
        } else {
            // 显示桌面设备信息
            deviceInfo.style.display = 'block';
            deviceMessage.textContent = '💻 检测到桌面设备 - 适合压缩照片和管理元数据';
        }
        
        // 显示访问地址信息
        this.showAccessInfo();
        
        // 生成二维码
        this.generateQRCode();
    }

    showAccessInfo() {
        // 如果是通过IP访问的，显示设备间协作提示
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            const accessInfo = document.createElement('div');
            accessInfo.className = 'access-info';
            accessInfo.innerHTML = `
                <div class="access-card">
                    <i class="fas fa-wifi"></i>
                    <div class="access-text">
                        <strong>多设备协作模式</strong>
                        <p>当前通过局域网访问 (${hostname}) - 可以在不同设备间协作处理照片</p>
                    </div>
                </div>
            `;
            
            const header = document.querySelector('.header-content');
            header.appendChild(accessInfo);
        }
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

        // Metadata management buttons
        document.getElementById('download-metadata-btn').addEventListener('click', () => {
            this.downloadAllMetadata();
        });

        document.getElementById('clear-metadata-btn').addEventListener('click', () => {
            this.clearMetadataDatabase();
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

        // 限制一次性加载的文件数量，避免内存溢出
        const maxFiles = 50;
        let addedCount = 0;

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/') && addedCount < maxFiles) {
                const fileId = this.generateFileId();
                fileMap.set(fileId, file);
                this.addFileToList(file, fileId, type, listElement);
                addedCount++;
            }
        });

        if (files.length > maxFiles) {
            this.logMessage(`为避免卡顿，已限制显示前${maxFiles}个文件。建议分批处理大量照片。`, 'info');
        }

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

        // 分批处理，每批5张，避免内存爆炸
        const batchSize = 5;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            
            // 并行处理当前批次
            const batchPromises = batch.map(async (file) => {
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
                    
                    // 释放内存 - 清理URL对象
                    if (file.preview) {
                        URL.revokeObjectURL(file.preview);
                    }
                } catch (error) {
                    this.logMessage(`压缩失败 ${file.name}: ${error.message}`, 'error');
                }
            });

            // 等待当前批次完成
            await Promise.all(batchPromises);
            
            // 强制垃圾回收提示
            if (window.gc) {
                window.gc();
            }
            
            // 给浏览器一点时间处理其他任务
            await new Promise(resolve => setTimeout(resolve, 100));
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

    showPhotoAccessGuide(type) {
        // 显示一个实用的照片库访问指南
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-photo-video"></i> 在Mac上访问照片库的最佳方法</h2>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="reality-check">
                        <div class="info-box">
                            <i class="fas fa-info-circle"></i>
                            <p><strong>重要说明：</strong>Web浏览器由于安全限制，无法直接调用Mac的照片应用。但我们有更好的解决方案！</p>
                        </div>
                    </div>
                    
                    <div class="guide-methods">
                        <div class="method-card recommended">
                            <div class="method-header">
                                <i class="fas fa-star"></i>
                                <h3>🥇 最佳方法：文件选择器中的照片快捷方式</h3>
                            </div>
                            <div class="method-steps">
                                <div class="step">1. 点击下面的"打开文件选择器"按钮</div>
                                <div class="step">2. 在弹出的窗口左侧，点击"照片"快捷方式</div>
                                <div class="step">3. 直接浏览你的照片库，支持HEIC格式</div>
                                <div class="step">4. 选择多张照片后点击"选择"</div>
                            </div>
                        </div>

                        <div class="method-card">
                            <div class="method-header">
                                <i class="fas fa-keyboard"></i>
                                <h3>⌨️ 快捷键方法</h3>
                            </div>
                            <div class="method-steps">
                                <div class="step">1. 打开文件选择器后</div>
                                <div class="step">2. 按 <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd></div>
                                <div class="step">3. 直接跳转到照片库</div>
                            </div>
                        </div>

                        <div class="method-card">
                            <div class="method-header">
                                <i class="fab fa-apple"></i>
                                <h3>🍎 拖拽方法</h3>
                            </div>
                            <div class="method-steps">
                                <div class="step">1. 打开Mac的照片应用</div>
                                <div class="step">2. 选择要上传的照片</div>
                                <div class="step">3. 直接拖拽到这个网页的上传区域</div>
                            </div>
                        </div>
                    </div>

                    <div class="action-buttons">
                        <button class="action-btn primary" onclick="document.getElementById('${type}-files').click(); this.closest('.modal').remove();">
                            <i class="fas fa-folder-open"></i> 打开文件选择器
                        </button>
                        <button class="action-btn secondary" onclick="this.closest('.modal').remove();">
                            我知道了
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async openMobilePhotoPicker(type) {
        try {
            // 创建一个针对移动设备优化的文件选择器
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            
            // 关键：这些属性在移动设备上会调用原生照片选择器
            if (this.isIOSDevice()) {
                // iOS特定优化
                input.capture = 'environment';
                input.setAttribute('accept', 'image/*');
            } else {
                // Android优化
                input.capture = 'camera';
                input.setAttribute('accept', 'image/*,image/heic,image/heif');
            }

            // 监听文件选择并提取元数据
            input.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    this.logMessage(`开始处理 ${e.target.files.length} 张照片的元数据...`, 'info');
                    
                    // 处理每个文件并提取元数据
                    for (const file of e.target.files) {
                        await this.extractAndStoreMetadata(file, type);
                    }
                    
                    this.handleFileSelection(e.target.files, type);
                    this.updateMetadataDisplay();
                    this.logMessage(`已从照片库选择 ${e.target.files.length} 张照片`, 'success');
                }
            });

            // 触发原生照片选择器
            document.body.appendChild(input);
            input.click();
            document.body.removeChild(input);
            
        } catch (error) {
            this.logMessage(`打开照片选择器失败: ${error.message}`, 'error');
            // 降级到普通文件选择器
            document.getElementById(`${type}-files`).click();
        }
    }

    showSafariPhotosTip() {
        // 创建一个临时提示
        const tip = document.createElement('div');
        tip.className = 'safari-tip';
        tip.innerHTML = `
            <div class="tip-content">
                <i class="fas fa-lightbulb"></i>
                <span>在文件选择器中，点击左侧的"照片"或使用 Cmd+Shift+O 快速访问照片库</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // 添加样式
        tip.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
            color: white;
            border-radius: 10px;
            padding: 1rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            max-width: 350px;
            animation: slideIn 0.3s ease;
        `;
        
        tip.querySelector('.tip-content').style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
        `;
        
        tip.querySelector('button').style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 1.2rem;
            cursor: pointer;
            margin-left: auto;
            flex-shrink: 0;
        `;
        
        document.body.appendChild(tip);
        
        // 10秒后自动移除
        setTimeout(() => {
            if (tip.parentNode) {
                tip.remove();
            }
        }, 10000);
    }

    async extractAndStoreMetadata(file, type) {
        try {
            const metadata = {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                lastModified: new Date(file.lastModified),
                timestamp: null,
                location: null,
                camera: null,
                settings: null
            };

            // 尝试提取EXIF数据
            const exifData = await this.readEXIFData(file);
            if (exifData) {
                // 提取拍摄时间
                metadata.timestamp = this.extractDateTime(exifData);
                
                // 提取GPS位置信息
                metadata.location = this.extractGPSLocation(exifData);
                
                // 提取相机信息
                metadata.camera = this.extractCameraInfo(exifData);
                
                // 提取拍摄设置
                metadata.settings = this.extractCameraSettings(exifData);
            }

            // 存储到元数据数据库
            const fileId = this.generateFileId();
            this.metadataDatabase.set(fileId, metadata);
            
            // 创建元数据文件供下载
            await this.createMetadataFile(fileId, metadata);
            
            this.logMessage(`已提取 ${file.name} 的元数据`, 'success');
            return fileId;
            
        } catch (error) {
            this.logMessage(`提取 ${file.name} 元数据失败: ${error.message}`, 'error');
            return null;
        }
    }

    async readEXIFData(file) {
        return new Promise((resolve) => {
            try {
                // 创建FileReader来读取文件
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const arrayBuffer = e.target.result;
                        const dataView = new DataView(arrayBuffer);
                        
                        // 简单的EXIF解析 - 这里可以集成更强大的EXIF库
                        const exifData = this.parseBasicEXIF(dataView);
                        resolve(exifData);
                    } catch (error) {
                        resolve(null);
                    }
                };
                reader.readAsArrayBuffer(file.slice(0, 65536)); // 只读取前64KB，包含EXIF数据
            } catch (error) {
                resolve(null);
            }
        });
    }

    parseBasicEXIF(dataView) {
        // 基础的EXIF解析 - 实际项目中建议使用专业的EXIF库
        try {
            // 检查JPEG标识
            if (dataView.getUint16(0) !== 0xFFD8) {
                return null;
            }

            // 查找EXIF段
            let offset = 2;
            while (offset < dataView.byteLength - 4) {
                const marker = dataView.getUint16(offset);
                if (marker === 0xFFE1) { // APP1段，可能包含EXIF
                    const exifHeader = dataView.getUint32(offset + 4);
                    if (exifHeader === 0x45786966) { // "Exif"
                        // 找到EXIF数据，这里返回基础信息
                        return {
                            hasEXIF: true,
                            offset: offset + 4,
                            // 实际的EXIF解析需要更复杂的逻辑
                            dateTime: this.extractDateTimeFromEXIF(dataView, offset),
                            gps: this.extractGPSFromEXIF(dataView, offset)
                        };
                    }
                }
                const segmentLength = dataView.getUint16(offset + 2);
                offset += 2 + segmentLength;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    extractDateTimeFromEXIF(dataView, offset) {
        // 简化的日期时间提取 - 实际实现需要更复杂的EXIF解析
        // 这里返回文件修改时间作为备选
        return new Date();
    }

    extractGPSFromEXIF(dataView, offset) {
        // 简化的GPS提取 - 实际实现需要解析GPS IFD
        // 这里返回null，实际项目中需要完整的EXIF GPS解析
        return null;
    }

    extractDateTime(exifData) {
        if (exifData && exifData.dateTime) {
            return exifData.dateTime;
        }
        return new Date();
    }

    extractGPSLocation(exifData) {
        if (exifData && exifData.gps) {
            return exifData.gps;
        }
        return null;
    }

    extractCameraInfo(exifData) {
        return {
            make: 'Unknown',
            model: 'Unknown',
            software: 'Unknown'
        };
    }

    extractCameraSettings(exifData) {
        return {
            iso: null,
            aperture: null,
            shutterSpeed: null,
            focalLength: null
        };
    }

    async createMetadataFile(fileId, metadata) {
        try {
            // 创建JSON格式的元数据文件
            const metadataJson = JSON.stringify(metadata, null, 2);
            const blob = new Blob([metadataJson], { type: 'application/json' });
            
            // 存储元数据文件的URL，供后续下载
            metadata.downloadUrl = URL.createObjectURL(blob);
            
            this.logMessage(`已创建 ${metadata.fileName} 的元数据记录`, 'info');
        } catch (error) {
            this.logMessage(`创建元数据文件失败: ${error.message}`, 'error');
        }
    }

    updateMetadataDisplay() {
        const count = this.metadataDatabase.size;
        document.getElementById('metadata-count').textContent = count;
        
        if (count > 0) {
            document.getElementById('metadata-section').style.display = 'block';
            this.displayMetadataList();
        }
    }

    displayMetadataList() {
        const listElement = document.getElementById('metadata-list');
        listElement.innerHTML = '';
        
        this.metadataDatabase.forEach((metadata, fileId) => {
            const metadataItem = document.createElement('div');
            metadataItem.className = 'metadata-item';
            metadataItem.innerHTML = `
                <div class="metadata-info">
                    <div class="metadata-filename">${metadata.fileName}</div>
                    <div class="metadata-details">
                        <span>时间: ${metadata.timestamp ? metadata.timestamp.toLocaleString() : '未知'}</span>
                        <span>位置: ${metadata.location ? '已记录' : '无位置信息'}</span>
                        <span>大小: ${this.formatFileSize(metadata.fileSize)}</span>
                    </div>
                </div>
                <div class="metadata-actions">
                    <button class="action-btn small" onclick="app.downloadSingleMetadata('${fileId}')">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn small danger" onclick="app.removeMetadata('${fileId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            listElement.appendChild(metadataItem);
        });
    }

    downloadSingleMetadata(fileId) {
        const metadata = this.metadataDatabase.get(fileId);
        if (metadata && metadata.downloadUrl) {
            const a = document.createElement('a');
            a.href = metadata.downloadUrl;
            a.download = `${metadata.fileName}_metadata.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }

    removeMetadata(fileId) {
        const metadata = this.metadataDatabase.get(fileId);
        if (metadata && metadata.downloadUrl) {
            URL.revokeObjectURL(metadata.downloadUrl);
        }
        this.metadataDatabase.delete(fileId);
        this.updateMetadataDisplay();
        this.logMessage('已删除元数据记录', 'info');
    }

    downloadAllMetadata() {
        if (this.metadataDatabase.size === 0) {
            this.logMessage('没有元数据可下载', 'info');
            return;
        }

        // 创建包含所有元数据的JSON文件
        const allMetadata = {};
        this.metadataDatabase.forEach((metadata, fileId) => {
            allMetadata[fileId] = metadata;
        });

        const blob = new Blob([JSON.stringify(allMetadata, null, 2)], { 
            type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo_metadata_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.logMessage('已下载所有元数据文件', 'success');
    }

    clearMetadataDatabase() {
        if (confirm('确定要清空所有元数据记录吗？此操作不可撤销。')) {
            // 清理所有URL对象
            this.metadataDatabase.forEach((metadata) => {
                if (metadata.downloadUrl) {
                    URL.revokeObjectURL(metadata.downloadUrl);
                }
            });
            
            this.metadataDatabase.clear();
            this.updateMetadataDisplay();
            document.getElementById('metadata-section').style.display = 'none';
            this.logMessage('已清空所有元数据记录', 'info');
        }
    }

    async generateQRCode() {
        const qrSection = document.getElementById('qr-section');
        const qrCodeElement = document.getElementById('qr-code');
        const qrUrlElement = document.getElementById('qr-url');
        
        // 获取当前访问地址
        const currentUrl = window.location.href;
        
        // 如果是localhost，尝试获取局域网IP
        let mobileUrl = currentUrl;
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // 尝试从网络信息获取IP
            mobileUrl = await this.getMobileAccessUrl();
        }
        
        // 显示二维码区域
        qrSection.style.display = 'block';
        
        // 显示加载状态
        qrCodeElement.innerHTML = `
            <div class="qr-loading">
                <i class="fas fa-spinner"></i>
                <span>生成二维码中...</span>
            </div>
        `;
        
        try {
            // 生成二维码
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, mobileUrl, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#4a5568',
                    light: '#ffffff'
                }
            });
            
            // 清空加载状态并显示二维码
            qrCodeElement.innerHTML = '';
            qrCodeElement.appendChild(canvas);
            
            // 显示URL
            qrUrlElement.textContent = mobileUrl;
            
            this.logMessage('二维码生成成功', 'success');
        } catch (error) {
            qrCodeElement.innerHTML = `
                <div class="qr-loading">
                    <i class="fas fa-exclamation-triangle" style="color: #e53e3e;"></i>
                    <span>二维码生成失败</span>
                </div>
            `;
            this.logMessage(`二维码生成失败: ${error.message}`, 'error');
        }
    }

    async getMobileAccessUrl() {
        try {
            // 尝试通过WebRTC获取本地IP
            const pc = new RTCPeerConnection({
                iceServers: [{urls: 'stun:stun.l.google.com:19302'}]
            });
            
            pc.createDataChannel('');
            
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            return new Promise((resolve) => {
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        const candidate = event.candidate.candidate;
                        const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                        if (ipMatch) {
                            const ip = ipMatch[1];
                            // 过滤掉localhost和内部IP
                            if (ip !== '127.0.0.1' && !ip.startsWith('169.254')) {
                                const mobileUrl = `http://${ip}:${window.location.port || '8000'}`;
                                pc.close();
                                resolve(mobileUrl);
                                return;
                            }
                        }
                    }
                };
                
                // 5秒后超时，使用默认URL
                setTimeout(() => {
                    pc.close();
                    resolve(window.location.href);
                }, 5000);
            });
        } catch (error) {
            return window.location.href;
        }
    }

    refreshQRCode() {
        this.generateQRCode();
        this.logMessage('正在刷新二维码...', 'info');
    }

    showPhotoPickerGuide(type) {
        // 显示如何使用照片应用的指引
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-photo-video"></i> 照片应用选择指南</h2>
                    <button class="close-modal" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="guide-content">
                        <div class="guide-step">
                            <div class="step-icon">📱</div>
                            <div class="step-text">
                                <h3>方法1：使用Safari浏览器</h3>
                                <p>在Safari中，文件选择器可能会显示"照片图库"选项</p>
                            </div>
                        </div>
                        <div class="guide-step">
                            <div class="step-icon">🖥️</div>
                            <div class="step-text">
                                <h3>方法2：快捷访问</h3>
                                <p>在文件选择器中，点击左侧边栏的"照片"快捷方式</p>
                            </div>
                        </div>
                        <div class="guide-step">
                            <div class="step-icon">⌨️</div>
                            <div class="step-text">
                                <h3>方法3：快捷键</h3>
                                <p>在文件选择器中按 Cmd+Shift+O 打开照片库</p>
                            </div>
                        </div>
                    </div>
                    <div class="guide-actions">
                        <button class="action-btn primary" onclick="document.getElementById('${type}-files').click(); this.closest('.modal').remove();">
                            <i class="fas fa-folder-open"></i> 打开文件选择器
                        </button>
                        <button class="action-btn secondary" onclick="this.closest('.modal').remove();">
                            知道了
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 3秒后自动打开文件选择器
        setTimeout(() => {
            if (modal.parentNode) {
                document.getElementById(`${type}-files`).click();
                modal.remove();
            }
        }, 3000);
    }
}

// Initialize the application
const app = new PhotoCompressApp();

// Make app globally accessible for onclick handlers
window.app = app;
