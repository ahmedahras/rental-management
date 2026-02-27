import 'dart:typed_data';

void saveFileFromBytes({
  required String filename,
  required Uint8List bytes,
  required String mimeType,
}) {
  throw UnsupportedError('File download is currently supported on Flutter web in this build.');
}
