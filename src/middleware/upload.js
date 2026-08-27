const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../uploads/receipts'));
    },
    filename: function (req, file, cb) {
        // Map mimetype to safe extension to prevent extension spoofing / stored XSS
        const extMap = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'application/pdf': '.pdf'
        };
        const ext = extMap[file.mimetype] || '.bin';
        const safeName = crypto.randomUUID() + ext;
        cb(null, safeName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

module.exports = { upload };
