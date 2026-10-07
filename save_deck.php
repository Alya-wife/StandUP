<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$decksDir = __DIR__ . '/decks';
if (!is_dir($decksDir)) {
    mkdir($decksDir, 0777, true);
}
$decksFile = __DIR__ . '/decks.json';
$decksSubFile = $decksDir . '/decks.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($decksSubFile)) {
        echo file_get_contents($decksSubFile);
    } else if (file_exists($decksFile)) {
        echo file_get_contents($decksFile);
    } else {
        echo json_encode([]);
    }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        http_response_code(400);
        echo json_encode(['error' => 'No payload provided']);
        exit;
    }

    $decoded = json_decode($raw, true);
    if (!$decoded || !is_array($decoded)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    // Merge or save directly
    $existing = [];
    if (file_exists($decksFile)) {
        $existing = json_decode(file_get_contents($decksFile), true) ?: [];
    }

    // If payload is a single deck object
    if (isset($decoded['id']) && isset($decoded['name'])) {
        $existing[$decoded['id']] = $decoded;
    } else {
        // If payload is full decks map
        foreach ($decoded as $k => $v) {
            $existing[$k] = $v;
        }
    }

    $jsonPretty = json_encode($existing, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    file_put_contents($decksFile, $jsonPretty);
    file_put_contents($decksSubFile, $jsonPretty);

    // Also write individual deck files in decks/
    foreach ($existing as $deckId => $deckData) {
        $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $deckId);
        file_put_contents($decksDir . '/' . $safeId . '.json', json_encode($deckData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    echo json_encode(['status' => 'success', 'count' => count($existing)]);
    exit;
}
