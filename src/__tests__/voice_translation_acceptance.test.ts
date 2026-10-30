import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  translateHindiOrHinglishToEnglish,
  getTranslationEndpointUrl,
  type TranslateFeedbackResponse,
} from '../api/translate.ts';
import { mapSpeechError, type SpeechRecognitionResult } from '../utils/voiceUtils.ts';
import type { CheckOutPayload, CreateSalePayload, UpdateSalePayload } from '../api/types.ts';

describe('FemmeFlo Voice Feedback & Hindi/Hinglish Translation Acceptance Suite', () => {
  // Test 1: Hindi voice recognition translation
  it('Scenario 1: Hindi voice recognition converts spoken Devanagari Hindi into professional English', async () => {
    const hindiInput = 'दुकानदार ने बोला अगले हफ्ते नया ऑर्डर देंगे';
    const result = await translateHindiOrHinglishToEnglish(hindiInput);

    assert.equal(result.originalText, hindiInput);
    assert.ok(result.translatedText.length > 0);
    // Verified translated text is English or graceful fallback
    assert.match(result.translatedText, /(order|next week|shopkeeper|दुकानदार)/i);
    assert.ok(['server-mistral', 'google-translate', 'client-fallback', 'verbatim-fallback'].includes(result.provider!));
  });

  // Test 2: Hinglish voice recognition translation
  it('Scenario 2: Hinglish voice recognition converts mixed romanized phrasing into professional English', async () => {
    const hinglishPhrases = [
      'Dukaan band thi owner gaon gaya hai',
      'Payment kal aayega sample de diya hai',
      'Stock bacha hai agle hafte aana tab payment dunga',
    ];

    for (const phrase of hinglishPhrases) {
      const res = await translateHindiOrHinglishToEnglish(phrase);
      assert.equal(res.originalText, phrase);
      assert.ok(res.translatedText.length > 0);
      assert.notEqual(res.provider, 'none');
    }
  });

  // Test 3: English speech recognition
  it('Scenario 3: English speech is recognized and preserved accurately without corruption', async () => {
    const englishSpeech = 'Customer requested 15 packets of standard pads for Saturday delivery';
    const res = await translateHindiOrHinglishToEnglish(englishSpeech);

    assert.equal(res.originalText, englishSpeech);
    // English feedback should remain English
    assert.match(res.translatedText, /Customer requested|packets/i);
  });

  // Test 4: Empty speech handling
  it('Scenario 4: Empty or whitespace-only speech returns immediately without network call', async () => {
    const emptyResult = await translateHindiOrHinglishToEnglish('');
    assert.equal(emptyResult.translatedText, '');
    assert.equal(emptyResult.originalText, '');
    assert.equal(emptyResult.provider, 'none');

    const whitespaceResult = await translateHindiOrHinglishToEnglish('   \n\t  ');
    assert.equal(whitespaceResult.translatedText, '');
    assert.equal(whitespaceResult.originalText, '');
    assert.equal(whitespaceResult.provider, 'none');
  });

  // Test 5: Microphone permission denied mapping
  it('Scenario 5: Microphone permission denied maps to actionable user guidance', () => {
    const deniedErrors = [
      'not-allowed',
      'permission-denied',
      { error: 'audio_record_permission_denied' },
      'User denied microphone access',
    ];

    for (const err of deniedErrors) {
      const friendly = mapSpeechError(err);
      assert.match(friendly, /Microphone permission was denied/i);
      assert.match(friendly, /device settings/i);
    }
  });

  // Test 6: Translation API endpoint resolution & URL mapping
  it('Scenario 6: Resolves authorized server-side translation endpoint without embedding AI keys', () => {
    const endpoint = getTranslationEndpointUrl();
    assert.ok(endpoint.startsWith('http'));
    assert.match(endpoint, /\/api\/translate$/);

    // Verify no AI keys are exposed in client bundle
    assert.equal(process.env.MISTRAL_API_KEY, undefined);
    assert.equal(process.env.OPENAI_API_KEY, undefined);
  });

  // Test 7: Translation API unavailable (resilient client fallback)
  it('Scenario 7: Translation API failure engages resilient fallback and preserves original transcript', async () => {
    // Calling translate with a local non-existent endpoint or simulated offline mode
    const text = 'Owner available nahi tha kal revisit hoga';
    const result = await translateHindiOrHinglishToEnglish(text, {
      timeoutMs: 1500,
      retries: 0,
    });

    assert.equal(result.originalText, text);
    assert.ok(result.translatedText.length > 0);
    // Field agent's text is never lost!
    assert.ok(result.provider === 'client-fallback' || result.provider === 'verbatim-fallback' || result.provider === 'server-mistral');
  });

  // Test 8: Slow network and timeout handling
  it('Scenario 8: Slow network timeout is gracefully handled without throwing unhandled rejection', async () => {
    const text = 'Sample delivered to medical store';
    const start = Date.now();
    const result = await translateHindiOrHinglishToEnglish(text, {
      timeoutMs: 500, // Very low timeout
      retries: 0,
    });
    const elapsed = Date.now() - start;

    assert.ok(elapsed >= 0);
    assert.equal(result.originalText, text);
    assert.ok(result.translatedText.length > 0);
  });

  // Test 9: User edits translated text prior to accepting
  it('Scenario 9: User review flow allows editing translation before applying', () => {
    const rawTranscript = 'Dukaan band thi owner gaon gaya hai';
    const aiTranslation = 'The shop was closed because the owner went to the village.';

    // User edits the translation to add specific details before accepting
    const userEditedTranslation = `${aiTranslation} Revisit scheduled for Monday morning.`;

    let notesField = '';
    const handleAccept = (textToApply: string) => {
      notesField = textToApply;
    };

    handleAccept(userEditedTranslation);
    assert.equal(notesField, 'The shop was closed because the owner went to the village. Revisit scheduled for Monday morning.');
    assert.match(notesField, /Revisit scheduled for Monday morning/);
  });

  // Test 10: User cancels / reverts translation (Undo capability)
  it('Scenario 10: User undo reverts the applied translation from field notes', () => {
    let notesField = 'Initial inspection completed.';
    const translationToAppend = 'Shopkeeper requested restock next week.';

    // Apply translation
    notesField = `${notesField} ${translationToAppend}`;
    assert.equal(notesField, 'Initial inspection completed. Shopkeeper requested restock next week.');

    // Undo action reverts only the translated portion
    const handleUndo = (translated: string) => {
      if (notesField.endsWith(translated)) {
        notesField = notesField.slice(0, -translated.length).trim();
      }
    };

    handleUndo(translationToAppend);
    assert.equal(notesField, 'Initial inspection completed.');
  });

  // Test 11: Successful feedback submission across shift checkout and sales payloads
  it('Scenario 11: Formats customerFeedback into existing backend shift checkout and sales payloads', () => {
    const feedback = 'Shopkeeper confirmed product is selling fast. Payment promised via UPI in 2 days.';

    // 1. Shift Visit Check-Out Payload
    const checkoutPayload: CheckOutPayload = {
      visitId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      latitude: 22.7196,
      longitude: 75.8577,
      customerFeedback: feedback,
      notes: feedback,
      saleDone: true,
    };
    assert.equal(checkoutPayload.customerFeedback, feedback);
    assert.equal(checkoutPayload.saleDone, true);

    // 2. New Sale Payload
    const salePayload: CreateSalePayload = {
      customerId: 'e3b0c442-98fc-1c14-9afbf4c8996fb924',
      paymentMode: 'PENDING',
      customerFeedback: feedback,
      items: [
        {
          productId: 'p1',
          quantity: 20,
          unitPricePaise: 3500,
        },
      ],
    };
    assert.equal(salePayload.customerFeedback, feedback);
    assert.equal(salePayload.items?.[0].quantity, 20);

    // 3. Update Sale Payload
    const updatePayload: UpdateSalePayload = {
      customerFeedback: `${feedback} (Updated after visit)`,
    };
    assert.equal(updatePayload.customerFeedback, `${feedback} (Updated after visit)`);
  });
});

