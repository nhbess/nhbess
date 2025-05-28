const profileImages = [
    '1.png',
    '2.png',
    '3.png',
    '4.png',
    '5.png',
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
    const images = document.querySelectorAll('.profile-image');
    const targetImage = document.querySelector(`.profile-image[data-image="${imgName}"]`);
    const currentActive = document.querySelector('.profile-image.active');
    
    if (targetImage && currentActive) {
        currentActive.classList.remove('active');
        targetImage.classList.add('active');
        
        try {
            const colorThief = new ColorThief();
            let palette = colorThief.getPalette(targetImage, 5);
            let color = palette[1] || palette[0];
            let brightness = getBrightness(color[0], color[1], color[2]);
            if (brightness < 150) {
                color = blendWithWhite(color[0], color[1], color[2], 0.3);
            }
            setAccentColor(rgbToHex(color[0], color[1], color[2]));
        } catch (e) {
            setAccentColor(getRandomColor());
        }
    }
}

function createCirclePoints() {
    const pointsContainer = document.getElementById('circlePoints');
    const imageRadius = 110; // 220/2
    const outerCircleRadius = 120; // 240/2
    const pointRadius = 10; // 20/2
    const gap = 20; // gap between image and point
    const pointsRadius = outerCircleRadius + gap + pointRadius; // 120 + 20 + 10 = 150
    const containerSize = 240; // match outer circle size
    const center = containerSize / 2; // 120
    const lineLength = pointsRadius - outerCircleRadius; // 150 - 120 = 30
    pointsContainer.innerHTML = '';
    
    // Get the currently active image
    const activeImage = document.querySelector('.profile-image.active');
    const activeImageName = activeImage ? activeImage.getAttribute('data-image') : profileImages[0];
    
    profileImages.forEach((img, i) => {
        const angle = (2 * Math.PI * i) / profileImages.length;
        const x = center + pointsRadius * Math.cos(angle);
        const y = center + pointsRadius * Math.sin(angle);
        const point = document.createElement('div');
        point.className = 'circle-point';
        if (img === activeImageName) {
            point.classList.add('active');
        }
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        point.style.setProperty('--line-length', `${lineLength}px`);
        point.style.setProperty('--line-angle', `${angle + Math.PI}rad`);
        point.title = img;
        // Add a wrapper for scaling effect
        const btnContent = document.createElement('div');
        btnContent.className = 'circle-point-content';
        point.appendChild(btnContent);
        point.onclick = () => {
            setMainImage(img);
            document.querySelectorAll('.circle-point').forEach(p => p.classList.remove('active'));
            point.classList.add('active');
        };
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

// Add click handler for random theme selection
function addImageClickHandler() {
    const images = document.querySelectorAll('.profile-image');
    images.forEach(image => {
        image.addEventListener('click', () => {
            const randomImage = profileImages[Math.floor(Math.random() * profileImages.length)];
            setMainImage(randomImage);
            // Update the corresponding circle point
            document.querySelectorAll('.circle-point').forEach(point => {
                point.classList.remove('active');
                if (point.title === randomImage) {
                    point.classList.add('active');
                }
            });
        });
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait for the particles system to be ready before setting the initial image and color
    function initWithParticles() {
        if (window.particleSystem) {
            const initialImage = profileImages[Math.floor(Math.random() * profileImages.length)];
            setMainImage(initialImage);
            createCirclePoints();
            // Add click handlers after images are loaded
            setTimeout(addImageClickHandler, 100);
        } else {
            setTimeout(initWithParticles, 50);
        }
    }
    initWithParticles();
}); 