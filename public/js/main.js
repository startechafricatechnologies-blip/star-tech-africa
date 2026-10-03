// ============ LOAD APPS FROM SERVER ============
async function loadApps() {
    try {
        const response = await fetch('/api/apps');
        const apps = await response.json();
        displayApps(apps);
    } catch (error) {
        console.error('Error loading apps:', error);
        document.getElementById('appsContainer').innerHTML = 
            '<p style="text-align:center;color:#e74c3c;padding:40px;">❌ Failed to load apps. Please refresh.</p>';
    }
}

// ============ DISPLAY APPS ============
function displayApps(apps) {
    const container = document.getElementById('appsContainer');
    container.innerHTML = apps.map(app => `
        <div class="app-card">
            <div class="app-icon">${app.icon}</div>
            <h3>${app.name}</h3>
            <p>${app.description}</p>
            <span class="app-price">KES ${app.price}</span>
            <button class="btn-buy" onclick="buyApp('${app.id}', '${app.name}', ${app.price})">
                Buy Now 💳
            </button>
        </div>
    `).join('');
}

// ============ BUY APP - PAYSTACK PAYMENT ============
async function buyApp(appId, appName, price) {
    // Show loading state
    const buttons = document.querySelectorAll('.btn-buy');
    buttons.forEach(btn => {
        btn.textContent = '⏳ Processing...';
        btn.disabled = true;
    });

    try {
        // Get customer email
        const email = prompt('Enter your email address for the download link:', 'customer@example.com');
        
        if (!email) {
            alert('Email is required to receive your download link.');
            buttons.forEach(btn => {
                btn.textContent = 'Buy Now 💳';
                btn.disabled = false;
            });
            return;
        }

        // Initialize payment with server
        const response = await fetch('/api/initialize-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                appId: appId,
                appName: appName,
                price: price,
                customerEmail: email
            })
        });

        const data = await response.json();

        if (data.authorization_url) {
            // Redirect to Paystack payment page
            window.location.href = data.authorization_url;
        } else {
            alert('Payment initialization failed: ' + (data.error || 'Unknown error'));
            buttons.forEach(btn => {
                btn.textContent = 'Buy Now 💳';
                btn.disabled = false;
            });
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Error: ' + error.message);
        buttons.forEach(btn => {
            btn.textContent = 'Buy Now 💳';
            btn.disabled = false;
        });
    }
}

// ============ CONTACT FORM ============
function sendMessage(event) {
    event.preventDefault();
    
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    const statusEl = document.getElementById('formStatus');
    
    // Validate
    if (!name || !email || !message) {
        statusEl.style.color = '#e74c3c';
        statusEl.textContent = '⚠️ Please fill in all fields.';
        return;
    }
    
    // Show loading
    statusEl.style.color = '#667eea';
    statusEl.textContent = '⏳ Sending message...';
    
    // Simulate sending (you can connect to a real email service later)
    setTimeout(() => {
        statusEl.style.color = '#2ecc71';
        statusEl.textContent = `✅ Thank you ${name}! Your message has been sent. We'll get back to you soon.`;
        
        // Clear form
        document.getElementById('contactForm').reset();
        
        // Reset after 5 seconds
        setTimeout(() => {
            statusEl.textContent = '';
        }, 5000);
    }, 1500);
}

// ============ SMOOTH SCROLL FOR NAVIGATION ============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============ NAVBAR SCROLL EFFECT ============
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 2px 30px rgba(0,0,0,0.15)';
    } else {
        navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.08)';
    }
});

// ============ LOAD APPS WHEN PAGE LOADS ============
document.addEventListener('DOMContentLoaded', loadApps);

// ============ KEYBOARD SHORTCUT: ESC TO CLOSE ANY MODAL ============
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('checkoutModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
});

console.log('🚀 StarTech Africa - Website Loaded Successfully!');
console.log('📱 Visit: https://startechafrica.co.ke');
// ============ VIDEO PLACEHOLDER CLICK ============
document.querySelectorAll('.video-placeholder').forEach(video => {
    video.addEventListener('click', function() {
        alert('🎥 Video demo coming soon!\n\nYou can replace this with your actual YouTube/Vimeo video.');
    });
});

// ============ SCREENSHOT CLICK ============
document.querySelectorAll('.screenshot-card').forEach(screenshot => {
    screenshot.addEventListener('click', function() {
        alert('📸 Screenshot preview coming soon!\n\nYou can replace this with your actual app screenshots.');
    });
});