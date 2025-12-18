#!/bin/bash
SOURCE="AppIcons (1)/appstore.png"
DEST="ios/App/App/Assets.xcassets/AppIcon.appiconset"

# Ensure source exists
if [ ! -f "$SOURCE" ]; then
    echo "Error: Source file $SOURCE not found"
    ls -l "AppIcons (1)"
    exit 1
fi

mkdir -p "$DEST"

# Sizes mapping: filename size
declare -a sizes=(
    "AppIcon-20x20@1x.png 20"
    "AppIcon-20x20@2x.png 40"
    "AppIcon-20x20@3x.png 60"
    "AppIcon-29x29@1x.png 29"
    "AppIcon-29x29@2x.png 58"
    "AppIcon-29x29@3x.png 87"
    "AppIcon-40x40@1x.png 40"
    "AppIcon-40x40@2x.png 80"
    "AppIcon-40x40@3x.png 120"
    "AppIcon-60x60@2x.png 120"
    "AppIcon-60x60@3x.png 180"
    "AppIcon-76x76@1x.png 76"
    "AppIcon-76x76@2x.png 152"
    "AppIcon-83.5x83.5@2x.png 167"
    "AppIcon-1024x1024@1x.png 1024"
)

for pair in "${sizes[@]}"; do
    name=$(echo $pair | cut -d' ' -f1)
    size=$(echo $pair | cut -d' ' -f2)
    sips -z $size $size "$SOURCE" --out "$DEST/$name"
done

# Create Contents.json
cat << 'JSON' > "$DEST/Contents.json"
{
  "images" : [
    { "size" : "20x20", "idiom" : "iphone", "filename" : "AppIcon-20x20@2x.png", "scale" : "2x" },
    { "size" : "20x20", "idiom" : "iphone", "filename" : "AppIcon-20x20@3x.png", "scale" : "3x" },
    { "size" : "29x29", "idiom" : "iphone", "filename" : "AppIcon-29x29@2x.png", "scale" : "2x" },
    { "size" : "29x29", "idiom" : "iphone", "filename" : "AppIcon-29x29@3x.png", "scale" : "3x" },
    { "size" : "40x40", "idiom" : "iphone", "filename" : "AppIcon-40x40@2x.png", "scale" : "2x" },
    { "size" : "40x40", "idiom" : "iphone", "filename" : "AppIcon-40x40@3x.png", "scale" : "3x" },
    { "size" : "60x60", "idiom" : "iphone", "filename" : "AppIcon-60x60@2x.png", "scale" : "2x" },
    { "size" : "60x60", "idiom" : "iphone", "filename" : "AppIcon-60x60@3x.png", "scale" : "3x" },
    { "size" : "20x20", "idiom" : "ipad", "filename" : "AppIcon-20x20@1x.png", "scale" : "1x" },
    { "size" : "20x20", "idiom" : "ipad", "filename" : "AppIcon-20x20@2x.png", "scale" : "2x" },
    { "size" : "29x29", "idiom" : "ipad", "filename" : "AppIcon-29x29@1x.png", "scale" : "1x" },
    { "size" : "29x29", "idiom" : "ipad", "filename" : "AppIcon-29x29@2x.png", "scale" : "2x" },
    { "size" : "40x40", "idiom" : "ipad", "filename" : "AppIcon-40x40@1x.png", "scale" : "1x" },
    { "size" : "40x40", "idiom" : "ipad", "filename" : "AppIcon-40x40@2x.png", "scale" : "2x" },
    { "size" : "76x76", "idiom" : "ipad", "filename" : "AppIcon-76x76@1x.png", "scale" : "1x" },
    { "size" : "76x76", "idiom" : "ipad", "filename" : "AppIcon-76x76@2x.png", "scale" : "2x" },
    { "size" : "83.5x83.5", "idiom" : "ipad", "filename" : "AppIcon-83.5x83.5@2x.png", "scale" : "2x" },
    { "size" : "1024x1024", "idiom" : "ios-marketing", "filename" : "AppIcon-1024x1024@1x.png", "scale" : "1x" }
  ],
  "info" : {
    "version" : 1,
    "author" : "xcode"
  }
}
JSON
