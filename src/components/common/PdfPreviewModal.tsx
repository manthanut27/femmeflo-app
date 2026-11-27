import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { tokenStorage } from '@/api/client';
import { BorderRadius, BrandColors, Colors, Spacing, Typography } from '@/constants/theme';

interface PdfPreviewModalProps {
  visible: boolean;
  pdfUrl: string | null;
  filename?: string;
  title?: string;
  onClose: () => void;
}

export function PdfPreviewModal({
  visible,
  pdfUrl,
  filename = 'Invoice.pdf',
  title = 'Tax Invoice',
  onClose,
}: PdfPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [base64Pdf, setBase64Pdf] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!visible || !pdfUrl) {
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadPdf() {
      if (!pdfUrl) return;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.open(pdfUrl, '_blank');
        }
        onClose();
        return;
      }

      setLoading(true);
      setError(null);
      setBase64Pdf(null);

      try {
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetUri = `${FileSystem.cacheDirectory}${safeName}`;
        const freshUrl = pdfUrl.includes('?')
          ? `${pdfUrl}&_t=${Date.now()}`
          : `${pdfUrl}?_t=${Date.now()}`;

        const info = await FileSystem.getInfoAsync(targetUri);
        let uriToRead = targetUri;

        try {
          const token = await tokenStorage.getToken();
          const downloadRes = await FileSystem.downloadAsync(freshUrl, targetUri, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              'Cache-Control': 'no-cache',
            },
          });

          if (downloadRes.status !== 200) {
            throw new Error(`Could not fetch PDF from server (HTTP ${downloadRes.status}).`);
          }
          uriToRead = downloadRes.uri;
        } catch (downloadErr) {
          // Offline resilience: fall back to cached copy only if network fetch fails
          if (!info.exists || (info.size ?? 0) === 0) {
            throw downloadErr;
          }
          uriToRead = targetUri;
        }

        const b64 = await FileSystem.readAsStringAsync(uriToRead, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (!cancelled) {
          setLocalUri(uriToRead);
          setBase64Pdf(b64);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load invoice PDF.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [visible, pdfUrl, filename]);

  const handleShare = async () => {
    if (!localUri || sharing) return;
    setSharing(true);
    try {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${title}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Saved', `PDF saved at: ${localUri}`);
      }
    } catch (err: any) {
      Alert.alert('Share Failed', err?.message || 'Unable to share PDF.');
    } finally {
      setSharing(false);
    }
  };

  const pdfHtml = base64Pdf
    ? `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes" />
  <style>
    body { margin: 0; padding: 8px; background: #F1F5F9; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    canvas { width: 100%; height: auto; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 6px; }
    #status { font-family: sans-serif; color: #64748B; font-size: 13px; margin-top: 24px; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head>
<body>
  <div id="status">Rendering PDF...</div>
  <div id="pages" style="width:100%;"></div>
  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const raw = atob('${base64Pdf}');
    const uint8 = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) uint8[i] = raw.charCodeAt(i);
    pdfjsLib.getDocument({ data: uint8 }).promise.then(async (pdf) => {
      document.getElementById('status').style.display = 'none';
      const container = document.getElementById('pages');
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      }
    }).catch((err) => {
      document.getElementById('status').innerText = 'Preview error: ' + err.message;
    });
  </script>
</body>
</html>`
    : '';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{filename}</Text>
            </View>
            <View style={styles.headerActions}>
              {localUri ? (
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={handleShare}
                  disabled={sharing}
                  activeOpacity={0.75}
                >
                  {sharing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                  )}
                  <Text style={styles.shareBtnText}>Share</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.75}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.body}>
            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={BrandColors.pink.dark} />
                <Text style={styles.loadingText}>Loading Invoice PDF...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerState}>
                <Ionicons name="alert-circle-outline" size={36} color="#DC2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : base64Pdf ? (
              <WebView
                originWhitelist={['*']}
                source={{ html: pdfHtml }}
                style={{ flex: 1, backgroundColor: '#F1F5F9' }}
                scalesPageToFit
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    height: '84%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#FFFFFF',
  },
  title: {
    ...Typography.h4,
    color: '#0F172A',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BrandColors.pink.dark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
});
