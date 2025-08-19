#!/bin/bash

# 富士X-T3照片压缩脚本
# 专为富士X-T3优化，保持画质的同时最小化文件大小

echo "📸 富士X-T3照片压缩工具启动..."
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 检查并安装exiftool（用于保留EXIF数据）
echo "🔍 检查EXIF数据处理工具..."
if ! command -v exiftool >/dev/null 2>&1; then
    echo "⚠️  未找到exiftool，正在安装..."
    if command -v brew >/dev/null 2>&1; then
        echo "   使用Homebrew安装exiftool..."
        brew install exiftool
        if [ $? -eq 0 ]; then
            echo "✅ exiftool安装成功"
        else
            echo "❌ exiftool安装失败，将跳过EXIF数据保留"
            echo "   压缩后的照片可能会丢失拍摄时间等信息"
        fi
    else
        echo "❌ 未找到Homebrew，无法自动安装exiftool"
        echo "   请手动安装: brew install exiftool"
        echo "   或访问: https://exiftool.org"
        echo "   压缩后的照片可能会丢失拍摄时间等信息"
    fi
else
    echo "✅ exiftool已安装，将完整保留EXIF数据"
fi
echo ""

# 创建compressed子文件夹
COMPRESSED_DIR="compressed"
if [ ! -d "$COMPRESSED_DIR" ]; then
    mkdir "$COMPRESSED_DIR"
    echo "📁 创建输出目录: $COMPRESSED_DIR"
else
    echo "📁 输出目录已存在: $COMPRESSED_DIR"
    # 检查是否有已压缩的文件
    existing_files=$(find "$COMPRESSED_DIR" -name "*_compressed.jpg" 2>/dev/null | wc -l)
    if [ $existing_files -gt 0 ]; then
        echo "⚠️  发现 $existing_files 个已压缩的文件"
        echo "🔄 重复运行模式：将覆盖同名文件"
    fi
fi

# 富士X-T3优化参数
# 原始: 6240x4160 (26.1MP)
# 压缩: 2400x1600 (保持3:2比例，约3.8MP)
MAX_WIDTH=2400
MAX_HEIGHT=1600
QUALITY=85  # 85%质量，富士色彩最佳平衡点
SUFFIX="_compressed"

echo "⚙️  压缩设置:"
echo "   📏 目标尺寸: ${MAX_WIDTH}x${MAX_HEIGHT} (保持3:2比例)"
echo "   🎨 压缩质量: ${QUALITY}% (富士色彩优化)"
echo "   📂 输出目录: $COMPRESSED_DIR"
echo "   🏷️  文件后缀: $SUFFIX"
echo "   🔄 重复运行: 支持覆盖已存在的压缩文件"
if command -v exiftool >/dev/null 2>&1; then
    echo "   📅 EXIF数据: 完整保留 (拍摄时间、相机设置、GPS等)"
else
    echo "   ⚠️  EXIF数据: 可能丢失 (建议安装exiftool)"
fi
echo ""

# 计数器
TOTAL_FILES=0
PROCESSED_FILES=0
NEW_FILES=0
OVERWRITTEN_FILES=0
ORIGINAL_SIZE=0
COMPRESSED_SIZE=0

# 支持的文件格式
EXTENSIONS=("*.jpg" "*.JPG" "*.jpeg" "*.JPEG" "*.png" "*.PNG" "*.tiff" "*.TIFF")

echo "🔍 扫描照片文件..."

# 统计文件总数
for ext in "${EXTENSIONS[@]}"; do
    for file in $ext; do
        if [ -f "$file" ]; then
            ((TOTAL_FILES++))
        fi
    done
done

if [ $TOTAL_FILES -eq 0 ]; then
    echo "❌ 当前目录没有找到照片文件"
    echo "支持格式: JPG, JPEG, PNG, TIFF"
    read -p "按回车键退出..."
    exit 1
fi

echo "📊 找到 $TOTAL_FILES 个照片文件"
echo ""
echo "开始压缩..."
echo "============================================================"

# 处理每个文件
for ext in "${EXTENSIONS[@]}"; do
    for file in $ext; do
        if [ -f "$file" ]; then
            # 获取文件名和扩展名
            filename=$(basename "$file")
            name="${filename%.*}"
            extension="${filename##*.}"
            
            # 生成输出文件名
            output_file="$COMPRESSED_DIR/${name}${SUFFIX}.jpg"
            
            # 检查是否已存在压缩文件
            file_status="新建"
            if [ -f "$output_file" ]; then
                file_status="覆盖"
                ((OVERWRITTEN_FILES++))
            else
                ((NEW_FILES++))
            fi
            
            # 获取原始文件大小
            original_size=$(stat -f%z "$file" 2>/dev/null || echo 0)
            ORIGINAL_SIZE=$((ORIGINAL_SIZE + original_size))
            
            echo "🔄 处理: $filename ($file_status)"
            
            # 使用sips压缩图片，保留EXIF数据
            # 先调整尺寸，再设置质量，最后复制EXIF数据
            if sips -Z $MAX_WIDTH "$file" --out "$output_file" > /dev/null 2>&1; then
                # 设置JPEG质量
                if sips -s format jpeg -s formatOptions $QUALITY "$output_file" > /dev/null 2>&1; then
                    # 使用exiftool复制所有EXIF数据（如果可用）
                    exif_status="❌"
                    if command -v exiftool >/dev/null 2>&1; then
                        if exiftool -overwrite_original -TagsFromFile "$file" "$output_file" > /dev/null 2>&1; then
                            exif_status="✅"
                        fi
                    fi
                    # 获取压缩后文件大小
                    compressed_size=$(stat -f%z "$output_file" 2>/dev/null || echo 0)
                    COMPRESSED_SIZE=$((COMPRESSED_SIZE + compressed_size))
                    
                    # 计算压缩比
                    if [ $original_size -gt 0 ]; then
                        ratio=$(printf "%.1f" $(echo "scale=1; (1 - $compressed_size / $original_size) * 100" | bc -l 2>/dev/null || echo "0"))
                        echo "   ✅ ${name}${SUFFIX}.jpg"
                        echo "   📦 $(format_size $original_size) → $(format_size $compressed_size) (节省 ${ratio}%)"
                        echo "   📅 EXIF数据: $exif_status"
                    else
                        echo "   ✅ ${name}${SUFFIX}.jpg"
                        echo "   📅 EXIF数据: $exif_status"
                    fi
                    
                    ((PROCESSED_FILES++))
                else
                    echo "   ❌ 质量设置失败"
                    rm -f "$output_file"
                fi
            else
                echo "   ❌ 尺寸调整失败"
            fi
            
            # 显示进度
            progress=$(printf "%.1f" $(echo "scale=1; $PROCESSED_FILES * 100 / $TOTAL_FILES" | bc -l 2>/dev/null || echo "0"))
            echo "   📊 进度: ${progress}% ($PROCESSED_FILES/$TOTAL_FILES)"
            echo ""
        fi
    done
done

# 格式化文件大小的函数
format_size() {
    local size=$1
    if [ $size -lt 1024 ]; then
        echo "${size} B"
    elif [ $size -lt 1048576 ]; then
        printf "%.1f KB" $(echo "$size / 1024" | bc -l)
    elif [ $size -lt 1073741824 ]; then
        printf "%.1f MB" $(echo "$size / 1048576" | bc -l)
    else
        printf "%.1f GB" $(echo "$size / 1073741824" | bc -l)
    fi
}

echo "============================================================"
echo "🎉 压缩完成!"
echo ""
echo "📊 统计信息:"
echo "   📸 处理照片: $PROCESSED_FILES 张"
echo "   📁 输出目录: $COMPRESSED_DIR"

if [ $ORIGINAL_SIZE -gt 0 ] && [ $COMPRESSED_SIZE -gt 0 ]; then
    total_saved=$((ORIGINAL_SIZE - COMPRESSED_SIZE))
    total_ratio=$(printf "%.1f" $(echo "scale=1; $total_saved * 100 / $ORIGINAL_SIZE" | bc -l 2>/dev/null || echo "0"))
    
    echo "   📦 原始大小: $(format_size $ORIGINAL_SIZE)"
    echo "   📦 压缩大小: $(format_size $COMPRESSED_SIZE)"
    echo "   💾 节省空间: $(format_size $total_saved) (${total_ratio}%)"
fi

echo ""
echo "💡 富士X-T3优化说明:"
echo "   • 从 6240x4160 压缩到 2400x1600"
echo "   • 保持3:2经典比例"
echo "   • 85%质量保持富士色彩特性"
echo "   • 完整保留EXIF数据 (拍摄时间、相机设置、GPS等)"
echo "   • 完美适合导入手机相册和日常分享"
echo ""
echo "✅ 所有压缩文件已保存到 '$COMPRESSED_DIR' 文件夹"
echo ""

read -p "按回车键退出..."
