#!/bin/bash

# Photo Compress & Location Sync 一键启动脚本

echo "🚀 启动 Photo Compress & Location Sync..."
echo ""

# 检查并杀死占用端口的进程
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
    echo "🔄 端口8000被占用，正在释放..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    sleep 1
fi

# 获取所有IP地址
echo "🔍 检测网络连接..."
IPS=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}')

if [ -z "$IPS" ]; then
    echo "❌ 无法获取IP地址，请检查网络连接"
    exit 1
fi

echo "📍 检测到的IP地址:"
PRIMARY_IP=""
HOTSPOT_IP=""

while IFS= read -r ip; do
    echo "   $ip"
    
    # 检测是否是手机热点IP (通常是172.20.10.x)
    if [[ $ip == 172.20.10.* ]]; then
        HOTSPOT_IP=$ip
        echo "   ↳ 📱 手机热点IP"
    # 检测是否是常见的路由器IP段
    elif [[ $ip == 192.168.* ]] || [[ $ip == 10.* ]] || [[ $ip == 172.16.* ]] || [[ $ip == 172.17.* ]]; then
        if [ -z "$PRIMARY_IP" ]; then
            PRIMARY_IP=$ip
        fi
        echo "   ↳ 🏠 路由器网络"
    else
        if [ -z "$PRIMARY_IP" ]; then
            PRIMARY_IP=$ip
        fi
    fi
done <<< "$IPS"

# 优先使用手机热点IP
if [ -n "$HOTSPOT_IP" ]; then
    SELECTED_IP=$HOTSPOT_IP
    echo ""
    echo "✅ 推荐使用手机热点连接: $HOTSPOT_IP"
    echo "📱 手机热点的优势:"
    echo "   • IP地址相对固定 (通常是 172.20.10.x)"
    echo "   • 连接更稳定"
    echo "   • 不受路由器重启影响"
elif [ -n "$PRIMARY_IP" ]; then
    SELECTED_IP=$PRIMARY_IP
    echo ""
    echo "📶 使用WiFi网络: $PRIMARY_IP"
    echo "💡 建议: 使用手机热点可获得更稳定的连接"
else
    echo "❌ 无法确定可用的IP地址"
    exit 1
fi

echo ""
echo "🌐 访问地址:"
echo "   Mac本机: http://localhost:8000"
echo "   手机访问: http://$SELECTED_IP:8000"
echo ""

# 生成二维码
if command -v qrencode >/dev/null 2>&1; then
    echo "📱 手机扫描二维码快速访问:"
    qrencode -t ANSIUTF8 "http://$SELECTED_IP:8000"
    echo ""
else
    echo "💡 安装二维码生成器: brew install qrencode"
    echo ""
fi

echo "🎯 使用步骤:"
if [ -n "$HOTSPOT_IP" ]; then
    echo "1. 📱 确保Mac已连接到手机热点"
    echo "2. 📱 在手机浏览器中访问: http://$SELECTED_IP:8000"
    echo "3. 📱 选择照片并提取元数据"
    echo "4. 💻 在Mac上压缩照片并应用元数据"
else
    echo "1. 📶 确保手机和Mac连接到同一WiFi"
    echo "2. 📱 在手机浏览器中访问: http://$SELECTED_IP:8000"
    echo "3. 📱 选择照片并提取元数据"
    echo "4. 💻 在Mac上压缩照片并应用元数据"
    echo ""
    echo "🔥 推荐方案: 开启手机热点，让Mac连接手机热点"
    echo "   这样IP更稳定，通常是 172.20.10.2"
fi

echo ""
echo "按 Ctrl+C 停止服务器"
echo "----------------------------------------"

# 启动HTTP服务器
python3 -m http.server 8000 --bind 0.0.0.0
