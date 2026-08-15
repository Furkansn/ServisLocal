/**
 * Compresses an image file and returns a base64 string
 * @param file The image file to compress
 * @param maxWidth Max width of the output image
 * @param maxHeight Max height of the output image
 * @param quality Quality of the output JPEG (0.1 to 1.0)
 */
export async function compressImage(
    file: File, 
    maxWidth: number = 1024, 
    maxHeight: number = 1024, 
    quality: number = 0.7
): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale down if larger than max dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context not available'));
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to JPEG with specified quality
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
