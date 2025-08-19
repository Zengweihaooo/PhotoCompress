#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Photo Compress CLI Tool
一键压缩指定路径下的所有照片到子文件夹
"""

import os
import sys
import argparse
from PIL import Image, ExifTags
import json
from pathlib import Path
import shutil
from datetime import datetime

class PhotoCompressor:
    def __init__(self):
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        self.compressed_count = 0
        self.total_original_size = 0
        self.total_compressed_size = 0
        
    def compress_photos(self, input_path, quality=85, max_width=2400, max_height=1600, 
                       output_format='JPEG', output_folder='compressed'):
        """
        压缩指定路径下的所有照片
        """
        input_path = Path(input_path)
        
        if not input_path.exists():
            print(f"❌ 路径不存在: {input_path}")
            return False
            
        # 创建输出目录
        if input_path.is_file():
            output_dir = input_path.parent / output_folder
        else:
            output_dir = input_path / output_folder
            
        output_dir.mkdir(exist_ok=True)
        
        # 获取所有图片文件
        image_files = []
        if input_path.is_file():
            if input_path.suffix.lower() in self.supported_formats:
                image_files = [input_path]
        else:
            for ext in self.supported_formats:
                image_files.extend(input_path.glob(f"*{ext}"))
                image_files.extend(input_path.glob(f"*{ext.upper()}"))
        
        if not image_files:
            print(f"❌ 在 {input_path} 中没有找到支持的图片文件")
            return False
            
        print(f"🔍 找到 {len(image_files)} 个图片文件")
        print(f"📁 输出目录: {output_dir}")
        print(f"⚙️  压缩设置: 质量={quality}%, 最大尺寸={max_width}x{max_height}")
        print("=" * 60)
        
        # 压缩每个文件
        for i, image_file in enumerate(image_files, 1):
            try:
                self.compress_single_image(
                    image_file, output_dir, quality, max_width, max_height, output_format
                )
                progress = (i / len(image_files)) * 100
                print(f"📊 进度: {progress:.1f}% ({i}/{len(image_files)})")
            except Exception as e:
                print(f"❌ 压缩失败 {image_file.name}: {e}")
                
        # 显示统计信息
        self.show_statistics()
        return True
        
    def compress_single_image(self, input_file, output_dir, quality, max_width, max_height, output_format):
        """
        压缩单个图片文件
        """
        try:
            # 打开图片
            with Image.open(input_file) as img:
                # 保存原始EXIF信息
                exif_dict = {}
                if hasattr(img, '_getexif') and img._getexif() is not None:
                    exif_dict = img._getexif()
                
                # 转换为RGB模式（如果需要）
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # 计算新尺寸
                original_width, original_height = img.size
                new_width, new_height = self.calculate_new_size(
                    original_width, original_height, max_width, max_height
                )
                
                # 调整尺寸
                if (new_width, new_height) != (original_width, original_height):
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # 生成输出文件名
                if output_format.upper() == 'JPEG':
                    output_extension = '.jpg'
                else:
                    output_extension = f'.{output_format.lower()}'
                    
                output_file = output_dir / f"{input_file.stem}_compressed{output_extension}"
                
                # 保存压缩后的图片
                save_kwargs = {
                    'format': output_format,
                    'quality': quality,
                    'optimize': True
                }
                
                # 尝试保留EXIF信息
                if exif_dict and output_format.upper() == 'JPEG':
                    try:
                        save_kwargs['exif'] = img.info.get('exif', b'')
                    except:
                        pass
                
                img.save(output_file, **save_kwargs)
                
                # 统计信息
                original_size = input_file.stat().st_size
                compressed_size = output_file.stat().st_size
                compression_ratio = (1 - compressed_size / original_size) * 100
                
                self.total_original_size += original_size
                self.total_compressed_size += compressed_size
                self.compressed_count += 1
                
                print(f"✅ {input_file.name}")
                print(f"   📏 尺寸: {original_width}x{original_height} → {new_width}x{new_height}")
                print(f"   📦 大小: {self.format_size(original_size)} → {self.format_size(compressed_size)} (节省 {compression_ratio:.1f}%)")
                
        except Exception as e:
            raise Exception(f"处理图片时出错: {e}")
    
    def calculate_new_size(self, width, height, max_width, max_height):
        """
        计算新的图片尺寸
        """
        if width <= max_width and height <= max_height:
            return width, height
        
        # 计算缩放比例
        width_ratio = max_width / width
        height_ratio = max_height / height
        ratio = min(width_ratio, height_ratio)
        
        new_width = int(width * ratio)
        new_height = int(height * ratio)
        
        return new_width, new_height
    
    def format_size(self, size_bytes):
        """
        格式化文件大小
        """
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024
            i += 1
        
        return f"{size_bytes:.1f} {size_names[i]}"
    
    def show_statistics(self):
        """
        显示压缩统计信息
        """
        if self.compressed_count == 0:
            return
            
        total_compression_ratio = (1 - self.total_compressed_size / self.total_original_size) * 100
        
        print("=" * 60)
        print("📊 压缩完成统计:")
        print(f"   📸 处理照片: {self.compressed_count} 张")
        print(f"   📦 原始大小: {self.format_size(self.total_original_size)}")
        print(f"   📦 压缩大小: {self.format_size(self.total_compressed_size)}")
        print(f"   💾 节省空间: {self.format_size(self.total_original_size - self.total_compressed_size)} ({total_compression_ratio:.1f}%)")
        print("=" * 60)

def main():
    parser = argparse.ArgumentParser(
        description='Photo Compress CLI - 批量压缩照片工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python3 compress.py /path/to/photos                    # 使用默认设置压缩
  python3 compress.py /path/to/photos -q 90              # 设置质量为90%
  python3 compress.py /path/to/photos -s 1920 1080       # 设置最大尺寸
  python3 compress.py /path/to/photos -o my_compressed    # 自定义输出文件夹名
  python3 compress.py photo.jpg -q 75                    # 压缩单个文件
        """
    )
    
    parser.add_argument('path', help='要压缩的照片路径（文件或文件夹）')
    parser.add_argument('-q', '--quality', type=int, default=85, 
                       help='压缩质量 (10-100, 默认: 85)')
    parser.add_argument('-s', '--size', nargs=2, type=int, default=[2400, 1600],
                       metavar=('WIDTH', 'HEIGHT'), help='最大尺寸 (默认: 2400 1600)')
    parser.add_argument('-f', '--format', choices=['JPEG', 'PNG', 'WEBP'], default='JPEG',
                       help='输出格式 (默认: JPEG)')
    parser.add_argument('-o', '--output', default='compressed',
                       help='输出文件夹名 (默认: compressed)')
    
    # 添加预设选项
    parser.add_argument('--web', action='store_true', help='网络分享预设 (质量75%, 1920x1280)')
    parser.add_argument('--storage', action='store_true', help='存储备份预设 (质量90%, 3840x2560)')
    parser.add_argument('--fuji', action='store_true', help='富士X-T3平衡预设 (质量85%, 2400x1600)')
    
    args = parser.parse_args()
    
    # 应用预设
    if args.web:
        args.quality = 75
        args.size = [1920, 1280]
        print("🌐 使用网络分享预设")
    elif args.storage:
        args.quality = 90
        args.size = [3840, 2560]
        print("💾 使用存储备份预设")
    elif args.fuji:
        args.quality = 85
        args.size = [2400, 1600]
        print("📷 使用富士X-T3平衡预设")
    
    # 验证参数
    if not (10 <= args.quality <= 100):
        print("❌ 质量参数必须在 10-100 之间")
        return 1
    
    print("🚀 Photo Compress CLI 工具启动")
    print(f"📁 输入路径: {args.path}")
    
    # 开始压缩
    compressor = PhotoCompressor()
    success = compressor.compress_photos(
        args.path,
        quality=args.quality,
        max_width=args.size[0],
        max_height=args.size[1],
        output_format=args.format,
        output_folder=args.output
    )
    
    if success:
        print("🎉 压缩完成!")
        return 0
    else:
        print("❌ 压缩失败!")
        return 1

if __name__ == '__main__':
    sys.exit(main())
