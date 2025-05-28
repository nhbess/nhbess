class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.N = 100; // number of particles
        this.maxDistance = 300; // maximum distance for connections
        this.color = [100, 181, 246]; // default color (rgb)
        this.resize();
        this.initializeParticles();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.resize();
            this.initializeParticles();
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initializeParticles() {
        this.particles = [];
        
        for (let i = 0; i < this.N; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                radius: Math.random()*5 // Made particles slightly larger
            });
        }
    }

    update() {
        // Update positions
        for (let i = 0; i < this.N; i++) {
            // Update position
            this.particles[i].x += this.particles[i].vx;
            this.particles[i].y += this.particles[i].vy;

            // Wrap around edges
            if (this.particles[i].x < 0) this.particles[i].x = this.canvas.width;
            if (this.particles[i].x > this.canvas.width) this.particles[i].x = 0;
            if (this.particles[i].y < 0) this.particles[i].y = this.canvas.height;
            if (this.particles[i].y > this.canvas.height) this.particles[i].y = 0;
        }
    }

    setColor(rgbArr) {
        this.color = rgbArr;
    }

    draw() {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const [r, g, b] = this.color;
        // Draw connections
        for (let i = 0; i < this.N; i++) {
            for (let j = i + 1; j < this.N; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.maxDistance) {
                    const opacity = 1 - (distance / this.maxDistance);
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.25})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }

        // Draw particles
        this.particles.forEach(particle => {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
            this.ctx.fill();
        });
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// Initialize the particle system when the page loads
window.addEventListener('load', () => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);

    window.particleSystem = new ParticleSystem(canvas);
    window.particleSystem.animate();
}); 