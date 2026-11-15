/**
 * Dashboard Client-Side Global Helpers & Toast Notifications
 */

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '✖'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Global AJAX Form Submitter for settings modules
document.addEventListener('DOMContentLoaded', () => {
  // Lucide Icons Render
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Handle module auto-save forms
  const settingsForms = document.querySelectorAll('.ajax-save-form');
  settingsForms.forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const action = form.getAttribute('action');
      const submitBtn = form.querySelector('button[type="submit"]');
      const origText = submitBtn ? submitBtn.innerHTML : 'Save';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="inline-block animate-spin mr-2">⟳</span> Saving...';
      }

      const formData = new FormData(form);
      const data = {};

      formData.forEach((value, key) => {
        // Handle array fields (e.g. key ends with [])
        if (key.endsWith('[]')) {
          const cleanKey = key.slice(0, -2);
          if (!data[cleanKey]) data[cleanKey] = [];
          data[cleanKey].push(value);
        } else if (value === 'on') {
          data[key] = true;
        } else if (value === 'false') {
          data[key] = false;
        } else {
          data[key] = value;
        }
      });

      // Handle unchecked checkboxes
      form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (!cb.checked && !cb.name.endsWith('[]')) {
          data[cb.name] = false;
        }
      });

      try {
        const res = await fetch(action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const json = await res.json();
        if (res.ok && json.success) {
          showToast(json.message || 'Settings saved successfully!', 'success');
        } else {
          showToast(json.error || 'Failed to save settings.', 'error');
        }
      } catch (err) {
        showToast('Network error while saving settings.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
          if (window.lucide) window.lucide.createIcons();
        }
      }
    });
  });
});
