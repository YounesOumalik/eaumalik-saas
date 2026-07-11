const { Jimp } = require('jimp');

async function processLogo() {
  try {
    const image = await Jimp.read('public/logo.jpeg');
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const r = this.bitmap.data[idx + 0];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      let alpha = Math.max(r, g, b);
      
      if (alpha === 0) {
        this.bitmap.data[idx + 3] = 0;
      } else {
        this.bitmap.data[idx + 0] = Math.min(255, (r / alpha) * 255);
        this.bitmap.data[idx + 1] = Math.min(255, (g / alpha) * 255);
        this.bitmap.data[idx + 2] = Math.min(255, (b / alpha) * 255);
        
        let finalAlpha = alpha * 1.5;
        if (finalAlpha > 255) finalAlpha = 255;
        this.bitmap.data[idx + 3] = finalAlpha;
      }
    });

    await image.write('public/logo.png');
    console.log('Saved public/logo.png');
  } catch (err) {
    console.error(err);
  }
}

processLogo();
