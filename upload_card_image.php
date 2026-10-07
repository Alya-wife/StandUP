<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$imgDir = __DIR__ . '/img/Card';
if (!is_dir($imgDir)) {
    mkdir($imgDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 1. Direct file upload via multipart/form-data
    if (!empty($_FILES['image']) && is_uploaded_file($_FILES['image']['tmp_name'])) {
        $file = $_FILES['image'];
        $cardId = !empty($_POST['cardId']) ? $_POST['cardId'] : 'card_' . time();
        $safeName = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '_', $cardId));
        $destFile = $imgDir . '/' . $safeName . '.webp';

        // Check if file is already webp or image
        $tmp = $file['tmp_name'];
        $info = @getimagesize($tmp);
        if ($info) {
            // Convert to WebP using GD if available
            $im = null;
            if ($info[2] === IMAGETYPE_PNG && function_exists('imagecreatefrompng')) {
                $im = imagecreatefrompng($tmp);
            } else if ($info[2] === IMAGETYPE_JPEG && function_exists('imagecreatefromjpeg')) {
                $im = imagecreatefromjpeg($tmp);
            } else if ($info[2] === IMAGETYPE_WEBP && function_exists('imagecreatefromwebp')) {
                $im = imagecreatefromwebp($tmp);
            }

            if ($im && function_exists('imagewebp')) {
                imagewebp($im, $destFile, 90);
                imagedestroy($im);
            } else {
                move_uploaded_file($tmp, $destFile);
            }
        } else {
            move_uploaded_file($tmp, $destFile);
        }

        $relPath = 'img/Card/' . $safeName . '.webp';
        echo json_encode([
            'status' => 'success',
            'path' => $relPath,
            'filename' => $safeName . '.webp'
        ]);
        exit;
    }

    // 2. Base64 payload via JSON
    $raw = file_get_contents('php://input');
    if ($raw) {
        $data = json_decode($raw, true);
        if ($data && !empty($data['dataUrl'])) {
            $cardId = !empty($data['cardId']) ? $data['cardId'] : (!empty($data['filename']) ? pathinfo($data['filename'], PATHINFO_FILENAME) : 'card_' . time());
            $safeName = strtolower(preg_replace('/[^a-zA-Z0-9_-]/', '_', $cardId));
            $destFile = $imgDir . '/' . $safeName . '.webp';

            $base64 = preg_replace('/^data:image\/\w+;base64,/', '', $data['dataUrl']);
            $decoded = base64_decode($base64);

            if ($decoded !== false) {
                file_put_contents($destFile, $decoded);
                $relPath = 'img/Card/' . $safeName . '.webp';
                echo json_encode([
                    'status' => 'success',
                    'path' => $relPath,
                    'filename' => $safeName . '.webp'
                ]);
                exit;
            }
        }
    }

    http_response_code(400);
    echo json_encode(['error' => 'No image provided']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
