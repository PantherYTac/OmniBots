/**
 * Live Side-by-Side Discord Embed & Reaction Role Previewer
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- A. Embed Builder Live Preview ---
  const embedForm = document.getElementById('embed-builder-form');
  if (embedForm) {
    const inputTitle = document.getElementById('embed_title');
    const inputDesc = document.getElementById('embed_description');
    const inputColor = document.getElementById('embed_color');
    const inputThumb = document.getElementById('embed_thumbnail');
    const inputImage = document.getElementById('embed_image');
    const inputFooter = document.getElementById('embed_footer');

    const previewContainer = document.getElementById('preview_embed_box');
    const previewTitle = document.getElementById('preview_embed_title');
    const previewDesc = document.getElementById('preview_embed_desc');
    const previewThumb = document.getElementById('preview_embed_thumb');
    const previewImage = document.getElementById('preview_embed_image');
    const previewFooter = document.getElementById('preview_embed_footer');

    function updateEmbedPreview() {
      if (previewTitle) previewTitle.textContent = inputTitle?.value || 'Embed Title Preview';
      if (previewDesc) previewDesc.textContent = inputDesc?.value || 'This is how your Discord embed announcement will look in real-time...';
      if (previewContainer && inputColor) previewContainer.style.borderLeftColor = inputColor.value;

      if (previewThumb) {
        if (inputThumb?.value) {
          previewThumb.src = inputThumb.value;
          previewThumb.classList.remove('hidden');
        } else {
          previewThumb.classList.add('hidden');
        }
      }

      if (previewImage) {
        if (inputImage?.value) {
          previewImage.src = inputImage.value;
          previewImage.classList.remove('hidden');
        } else {
          previewImage.classList.add('hidden');
        }
      }

      if (previewFooter) {
        if (inputFooter?.value) {
          previewFooter.textContent = inputFooter.value;
          previewFooter.classList.remove('hidden');
        } else {
          previewFooter.classList.add('hidden');
        }
      }
    }

    [inputTitle, inputDesc, inputColor, inputThumb, inputImage, inputFooter].forEach(el => {
      if (el) el.addEventListener('input', updateEmbedPreview);
    });

    updateEmbedPreview();
  }

  // --- B. Reaction Role Panel Preview ---
  const rrForm = document.getElementById('rr-builder-form');
  if (rrForm) {
    const inputPanelTitle = document.getElementById('panel_title');
    const inputPanelDesc = document.getElementById('panel_desc');
    const previewPanelTitle = document.getElementById('preview_rr_title');
    const previewPanelDesc = document.getElementById('preview_rr_desc');

    function updateRrPreview() {
      if (previewPanelTitle) previewPanelTitle.textContent = inputPanelTitle?.value || 'Select Your Roles';
      if (previewPanelDesc) previewPanelDesc.textContent = inputPanelDesc?.value || 'Click the buttons below to receive or remove roles:';
    }

    if (inputPanelTitle) inputPanelTitle.addEventListener('input', updateRrPreview);
    if (inputPanelDesc) inputPanelDesc.addEventListener('input', updateRrPreview);
    updateRrPreview();
  }
});
