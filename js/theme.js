const profileImages = [
    '1.png',
    '2.png',
    '3.png',
    '4.png',
    '5.png',
    'ChatGPT Image May 25, 2025, 05_12_57 PM.png',
    'ChatGPT Image May 25, 2025, 05_13_36 PM.png',
    'thumbnail.jpg'
];

function setAccentColor(color) {
    document.documentElement.style.setProperty('--accent-color', color);
    // Generate a lighter hover color
    const hoverColor = lightenColor(color, 0.3);
    document.documentElement.style.setProperty('--accent-color-hover', hoverColor);
    // Update particles color
    if (window.particleSystem) {
        const rgb = hexToRgb(color);
        if (rgb) window.particleSystem.setColor([rgb.r, rgb.g, rgb.b]);
    }
}

function lightenColor(color, percent) {
    // Accepts hex color, returns lighter hex
    let num = parseInt(color.replace('#',''),16),
        amt = Math.round(2.55 * percent * 100),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
    return '#' + (
        0x1000000 +
        (R<255?R<1?0:R:255)*0x10000 +
        (G<255?G<1?0:G:255)*0x100 +
        (B<255?B<1?0:B:255)
    ).toString(16).slice(1);
}

function getRandomColor() {
    // Generate a random bright color
    const letters = '456789ABCD';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * letters.length)];
    }
    return color;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getBrightness(r, g, b) {
    // Perceived brightness formula
    return (r * 299 + g * 587 + b * 114) / 1000;
}

function blendWithWhite(r, g, b, percent) {
    // Blend the color with white by the given percent (0-1)
    return [
        Math.round(r + (255 - r) * percent),
        Math.round(g + (255 - g) * percent),
        Math.round(b + (255 - b) * percent)
    ];
}

function setMainImage(imgName) {
    const img = document.getElementById('mainProfileImage');
    img.crossOrigin = 'Anonymous'; // Needed for color extraction
    img.src = `assets/images_profile/${imgName}`;
    img.onload = function() {
        try {
            const colorThief = new ColorThief();
            let palette = colorThief.getPalette(img, 5);
            let color = palette[1] || palette[0]; // Use second color if available, else first
            let brightness = getBrightness(color[0], color[1], color[2]);
            if (brightness < 150) {
                color = blendWithWhite(color[0], color[1], color[2], 0.3); // blend 30% with white
            }
            setAccentColor(rgbToHex(color[0], color[1], color[2]));
        } catch (e) {
            setAccentColor(getRandomColor()); // fallback
        }
    };
}

function createCirclePoints() {
    const pointsContainer = document.getElementById('circlePoints');
    const containerSize = 360;
    const mainImageSize = 220;
    const pointSize = 30;
    const radius = (containerSize - mainImageSize) / 2 + mainImageSize / 2 - 30;
    const center = containerSize / 2;
    pointsContainer.innerHTML = '';
    profileImages.forEach((img, i) => {
        const angle = (2 * Math.PI * i) / profileImages.length;
        const x = center + radius * Math.cos(angle) - pointSize / 2;
        const y = center + radius * Math.sin(angle) - pointSize / 2;
        const point = document.createElement('div');
        point.className = 'circle-point';
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        point.title = img;
        point.onclick = () => setMainImage(img);
        pointsContainer.appendChild(point);
    });
}

function hexToRgb(hex) {
    // Convert hex to {r,g,b}
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    const num = parseInt(hex, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for the particles system to be ready before setting the initial image and color
    function initWithParticles() {
        if (window.particleSystem) {
            setMainImage(profileImages[Math.floor(Math.random() * profileImages.length)]);
            createCirclePoints();
        } else {
            setTimeout(initWithParticles, 50);
        }
    }
    initWithParticles();
}); 