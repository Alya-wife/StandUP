<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$cardsDir = __DIR__ . '/cards';
if (!is_dir($cardsDir)) {
    mkdir($cardsDir, 0777, true);
}
$cardsFile = $cardsDir . '/custom_cards.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($cardsFile)) {
        echo file_get_contents($cardsFile);
    } else {
        echo json_encode([]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        http_response_code(400);
        echo json_encode(['error' => 'No payload']);
        exit;
    }

    $decoded = json_decode($raw, true);
    if (!$decoded || !is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $existing = [];
    if (file_exists($cardsFile)) {
        $existing = json_decode(file_get_contents($cardsFile), true) ?: [];
    }

    // If payload is an array of cards (full list)
    if (isset($decoded[0]) && is_array($decoded[0])) {
        $existing = $decoded;
    } else if (isset($decoded['id'])) {
        // Single card upsert
        $found = false;
        foreach ($existing as $idx => $c) {
            if ($c['id'] === $decoded['id']) {
                $existing[$idx] = $decoded;
                $found = true;
                break;
            }
        }
        if (!$found) {
            $existing[] = $decoded;
        }
    }

    file_put_contents($cardsFile, json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    echo json_encode(['status' => 'success', 'count' => count($existing)]);
    exit;
}
