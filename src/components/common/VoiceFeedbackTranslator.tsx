import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { translateHindiOrHinglishToEnglish } from '@/api/translate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  BorderRadius,
  BrandColors,
  Colors,
  Elevation,
  HitSlop,
  Spacing,
  Typography,
} from '@/constants/theme';
import {
  SpeechRecognizer,
  isSpeechRecognitionSupported,
  type SupportedSpeechLanguage,
} from '@/utils/voiceUtils';

export interface VoiceFeedbackTranslatorProps {
  value: string;
  onChange: (newValue: string) => void;
  label?: string;
  sublabel?: string;
  placeholder?: string;
  required?: boolean;
  quickChips?: string[];
  style?: ViewStyle;
}

export function VoiceFeedbackTranslator({
  value,
  onChange,
  label = 'Customer Feedback & Observations',
  sublabel = 'Speak naturally in Hindi or Hinglish — automatically translates to concise English',
  placeholder = 'e.g. Shopkeeper ordered 15 packs of XL pads, requested delivery by Saturday...',
  required = false,
  quickChips = [
    'Dukaan band thi owner gaon gaya hai',
    'Payment kal aayega sample de diya hai',
    'Shopkeeper requested restock next week',
    'Customer very satisfied with pad softness',
    'Competitor sample offered at lower rate',
    'Payment promised via UPI in 2 days',
  ],
  style,
}: VoiceFeedbackTranslatorProps) {
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [spokenLanguage, setSpokenLanguage] = useState<SupportedSpeechLanguage>('hi-IN');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [translationAudit, setTranslationAudit] = useState<{ original: string; translated: string } | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Inline edit modal state for user review
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState('');

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize recognizer once
  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer();
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  // Pulsing animation for microphone recording indicator
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (isListening) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      animLoop?.stop();
    };
  }, [isListening, pulseAnim]);

  // Handle Voice Recording Start
  const handleStartListening = useCallback(async () => {
    setSpeechError(null);

    if (!recognizerRef.current?.isSupported()) {
      setSpeechError('Speech recognition is unavailable on this device. You can type feedback directly or tap quick chips below.');
      return;
    }

    setIsListening(true);
    setTranscript('');

    await recognizerRef.current.start(
      {
        onStart: () => {
          setIsListening(true);
        },
        onResult: (result) => {
          setTranscript(result.transcript);
          if (result.isFinal) {
            handleProcessTranscript(result.transcript);
          }
        },
        onError: (err) => {
          setIsListening(false);
          setSpeechError(err);
        },
        onEnd: () => {
          setIsListening(false);
        },
      },
      spokenLanguage
    );
  }, [spokenLanguage]);

  // Handle Stop Recording
  const handleStopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setIsListening(false);
    if (transcript.trim() && !isTranslating) {
      handleProcessTranscript(transcript.trim());
    }
  }, [transcript, isTranslating]);

  // Translate captured transcript (Hindi/Hinglish -> English)
  const handleProcessTranscript = async (rawText: string) => {
    if (!rawText.trim()) return;

    setIsTranslating(true);
    setSpeechError(null);

    try {
      const res = await translateHindiOrHinglishToEnglish(rawText);
      const translated = res.translatedText || rawText;

      setTranslatedText(translated);
      setTranslationAudit({
        original: rawText,
        translated,
      });
    } catch (err: any) {
      setTranslatedText(rawText);
      setTranslationAudit({
        original: rawText,
        translated: rawText,
      });
      setSpeechError('Translation server was unreachable. Original transcript has been preserved.');
    } finally {
      setIsTranslating(false);
    }
  };

  // User accepts translated feedback (never auto-submits)
  const handleAcceptTranslation = () => {
    if (!translatedText.trim()) return;
    const separator = value.trim().length > 0 ? '\n' : '';
    const updated = `${value.trim()}${separator}${translatedText.trim()}`.trim();
    onChange(updated);
    setTranscript('');
    setTranslatedText('');
  };

  // User reverts / undos last applied translation
  const handleUndo = () => {
    if (!translationAudit) return;
    const { translated } = translationAudit;
    if (value.endsWith(translated)) {
      const reverted = value.slice(0, -translated.length).trim();
      onChange(reverted);
    }
    setTranslationAudit(null);
  };

  // User clears pending transcript without applying
  const handleClearTranscript = () => {
    setTranscript('');
    setTranslatedText('');
    setTranslationAudit(null);
  };

  // User taps a quick-select chip
  const handleChipPress = async (chipText: string) => {
    // If chip is in Hindi/Hinglish, run through translation
    if (chipText.includes('thi') || chipText.includes('aayega') || chipText.includes('bacha')) {
      setTranscript(chipText);
      await handleProcessTranscript(chipText);
    } else {
      // English chip: apply or preview directly
      setTranscript(chipText);
      setTranslatedText(chipText);
    }
  };

  // Open inline edit modal for user review
  const handleOpenEdit = () => {
    setEditText(translatedText);
    setEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    setTranslatedText(editText.trim());
    setEditModalVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header with Title and Spoken Language Selector */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={styles.label}>
            {label} {required && <Text style={styles.requiredStar}>*</Text>}
          </Text>
          {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
        </View>

        {/* Spoken Language Toggle */}
        <View style={styles.langSelector}>
          <Pressable
            style={[styles.langBtn, spokenLanguage === 'hi-IN' && styles.langBtnActive]}
            onPress={() => setSpokenLanguage('hi-IN')}
            hitSlop={HitSlop.sm}
            accessibilityRole="button"
            accessibilityLabel="Speak in Hindi or Hinglish"
          >
            <Text style={[styles.langText, spokenLanguage === 'hi-IN' && styles.langTextActive]}>
              हिन्दी / Hinglish
            </Text>
          </Pressable>
          <Pressable
            style={[styles.langBtn, spokenLanguage === 'en-IN' && styles.langBtnActive]}
            onPress={() => setSpokenLanguage('en-IN')}
            hitSlop={HitSlop.sm}
            accessibilityRole="button"
            accessibilityLabel="Speak in Indian English"
          >
            <Text style={[styles.langText, spokenLanguage === 'en-IN' && styles.langTextActive]}>
              English
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Feedback Text Area */}
      <View style={styles.textAreaContainer}>
        <TextInput
          style={styles.textArea}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Floating Voice Microphone Trigger Button */}
        <View style={styles.micButtonContainer}>
          <Pressable
            style={[styles.micButton, isListening && styles.micButtonListening]}
            onPress={isListening ? handleStopListening : handleStartListening}
            accessibilityRole="button"
            accessibilityLabel={isListening ? 'Stop recording voice' : 'Start speaking voice feedback'}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons
                name={isListening ? 'stop' : 'mic'}
                size={22}
                color={isListening ? '#FFFFFF' : BrandColors.pink.primary}
              />
            </Animated.View>
          </Pressable>
        </View>
      </View>

      {/* Recording Status Banner */}
      {isListening && (
        <View style={styles.listeningBanner}>
          <View style={styles.listeningDot} />
          <Text style={styles.listeningText}>
            Listening ({spokenLanguage === 'hi-IN' ? 'Hindi/Hinglish' : 'English'})... Tap stop when done.
          </Text>
          <Pressable onPress={handleStopListening} hitSlop={HitSlop.sm}>
            <Text style={styles.stopText}>Done</Text>
          </Pressable>
        </View>
      )}

      {/* Translating Status Indicator */}
      {isTranslating && (
        <View style={styles.translatingBanner}>
          <ActivityIndicator size="small" color={BrandColors.pink.primary} />
          <Text style={styles.translatingText}>Translating Hindi/Hinglish to professional English...</Text>
        </View>
      )}

      {/* Speech Error Banner */}
      {speechError && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
          <Text style={styles.errorText} numberOfLines={2}>
            {speechError}
          </Text>
          <Pressable onPress={() => setSpeechError(null)} hitSlop={HitSlop.sm}>
            <Ionicons name="close" size={14} color="#64748B" />
          </Pressable>
        </View>
      )}

      {/* Translation Review & Accept Box */}
      {translatedText.length > 0 && !isTranslating && (
        <Card style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.reviewBadgeRow}>
              <Badge label="AI English Translation" variant="info" size="sm" />
              <Text style={styles.reviewHint}>Review before accepting</Text>
            </View>
            <Pressable onPress={handleClearTranscript} hitSlop={HitSlop.sm}>
              <Ionicons name="close-circle-outline" size={18} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Original Hindi/Hinglish Transcript */}
          {transcript.length > 0 && transcript !== translatedText && (
            <View style={styles.originalBox}>
              <Text style={styles.originalLabel}>Spoken Transcript:</Text>
              <Text style={styles.originalText}>"{transcript}"</Text>
            </View>
          )}

          {/* Translated English Output */}
          <View style={styles.translatedBox}>
            <Text style={styles.translatedLabel}>Professional English:</Text>
            <Text style={styles.translatedText}>"{translatedText}"</Text>
          </View>

          {/* Actions: Accept, Edit, Clear */}
          <View style={styles.actionRow}>
            <Button
              title="Accept Translation"
              variant="primary"
              size="sm"
              icon={<Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              onPress={handleAcceptTranslation}
              style={{ flex: 1, marginRight: Spacing.xs }}
            />
            <Button
              title="Edit"
              variant="secondary"
              size="sm"
              icon={<Ionicons name="pencil-outline" size={14} color="#334155" />}
              onPress={handleOpenEdit}
              style={{ marginRight: Spacing.xs }}
            />
            <Button
              title="Clear"
              variant="ghost"
              size="sm"
              onPress={handleClearTranscript}
            />
          </View>
        </Card>
      )}

      {/* Undo Button if previous translation is applied */}
      {translationAudit && value.includes(translationAudit.translated) && (
        <View style={styles.undoRow}>
          <Text style={styles.undoHint}>Translation added to notes.</Text>
          <Pressable style={styles.undoBtn} onPress={handleUndo} hitSlop={HitSlop.sm}>
            <Ionicons name="arrow-undo-outline" size={13} color={BrandColors.pink.dark} />
            <Text style={styles.undoBtnText}>Undo</Text>
          </Pressable>
        </View>
      )}

      {/* Quick Select Retail Feedback Chips */}
      {quickChips && quickChips.length > 0 && (
        <View style={styles.chipsSection}>
          <Text style={styles.chipsHeading}>Quick Retail Observations:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {quickChips.map((chip, idx) => (
              <Pressable
                key={idx}
                style={styles.chip}
                onPress={() => handleChipPress(chip)}
                accessibilityRole="button"
                accessibilityLabel={`Add note: ${chip}`}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={12} color={BrandColors.pink.dark} style={{ marginRight: 4 }} />
                <Text style={styles.chipText} numberOfLines={1}>
                  {chip}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Inline Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit English Translation</Text>
            <Text style={styles.modalSubtitle}>Adjust wording before applying to your field visit note:</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="secondary"
                size="md"
                onPress={() => setEditModalVisible(false)}
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Button
                title="Save & Accept"
                variant="primary"
                size="md"
                onPress={handleSaveEdit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  titleCol: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  label: {
    fontSize: Typography.bodySmall.fontSize,
    fontWeight: '700',
    color: Colors.light.textPrimary,
  },
  requiredStar: {
    color: '#E61C5D',
  },
  sublabel: {
    fontSize: Typography.caption.fontSize,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  langSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  langBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Elevation.low,
  },
  langText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  langTextActive: {
    color: BrandColors.pink.primary,
    fontWeight: '800',
  },
  textAreaContainer: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  textArea: {
    minHeight: 80,
    padding: Spacing.sm,
    paddingRight: 48,
    fontSize: Typography.bodySmall.fontSize,
    color: '#1E293B',
    lineHeight: 20,
  },
  micButtonContainer: {
    position: 'absolute',
    right: 8,
    bottom: 8,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BrandColors.pink.tint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BrandColors.pink.subtle,
    ...Elevation.low,
  },
  micButtonListening: {
    backgroundColor: BrandColors.pink.primary,
    borderColor: BrandColors.pink.dark,
  },
  listeningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginTop: 6,
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11D48',
    marginRight: 6,
  },
  listeningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9F1239',
    flex: 1,
  },
  stopText: {
    fontSize: 11,
    fontWeight: '800',
    color: BrandColors.pink.primary,
    marginLeft: 6,
  },
  translatingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginTop: 6,
  },
  translatingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    marginTop: 6,
  },
  errorText: {
    fontSize: 11,
    color: '#B91C1C',
    flex: 1,
  },
  reviewCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  originalBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.sm,
    padding: 6,
    marginBottom: 6,
  },
  originalLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  originalText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
    marginTop: 2,
  },
  translatedBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.sm,
    padding: 8,
    marginBottom: Spacing.xs,
  },
  translatedLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: BrandColors.pink.dark,
    textTransform: 'uppercase',
  },
  translatedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  undoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  undoHint: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  undoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: BrandColors.pink.dark,
  },
  chipsSection: {
    marginTop: Spacing.xs,
  },
  chipsHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipsScroll: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Elevation.high,
  },
  modalTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: '#64748B',
    marginBottom: Spacing.sm,
  },
  modalInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: Typography.bodySmall.fontSize,
    color: '#1E293B',
    marginBottom: Spacing.md,
  },
  modalBtnRow: {
    flexDirection: 'row',
  },
});

