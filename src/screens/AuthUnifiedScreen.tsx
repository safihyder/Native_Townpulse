import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { theme } from '../theme/tokens';
import LinearGradient from 'react-native-linear-gradient';

// We import all images to find the right ones; in a real scenario we'd rename them
const IMG_1 = require('../assets/images/887afb413e71cf0163583602e8a9969c31cb6d3c.png');
const IMG_2 = require('../assets/images/3d8cc70c77177be243430454adce888c-removebg-preview.png');
const GOOGLE_LOGO = require('../assets/images/google logo.png');
// You can adjust these imports once you verify which is which.

interface Props {
  isBusy: boolean;
  errorMessage: string | null;
  otpSent: boolean;
  isGoogleLinked?: boolean;
  onSendOtp: (phone: string) => void;
  onVerifyOtp: (otp: string) => void;
  onGoogleSignIn: () => void;
  phoneDraft: string;
  onChangePhone: (phone: string) => void;
  otpDraft: string;
  onChangeOtp: (otp: string) => void;
}

export function AuthUnifiedScreen({
  isBusy, errorMessage, otpSent, isGoogleLinked = false,
  onSendOtp, onVerifyOtp, onGoogleSignIn,
  phoneDraft, onChangePhone,
  otpDraft, onChangeOtp
}: Props) {

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Top Section with Gradient-like background (using a solid soft color for now) */}

        <LinearGradient
          colors={['#DFEFF8', '#FEEBC5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.topSection}
        >
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{isGoogleLinked ? 'Link phone' : 'Sign in'}</Text>
            <Text style={styles.subtitle}>{isGoogleLinked ? 'Verify your phone number to continue' : 'Welcome to Town Pulse!'}</Text>
          </View>

          <Image
            source={IMG_1}
            style={styles.topImage}
            resizeMode="contain"
          />
        </LinearGradient>


        <View style={styles.formSection}>
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          {/* Phone Input */}
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your Phone Number"
            placeholderTextColor={theme.colors.ink500}
            keyboardType="phone-pad"
            value={phoneDraft}
            onChangeText={onChangePhone}
            editable={!isBusy}
          />

          {/* Send OTP Button (Link style) */}
          <TouchableOpacity
            style={styles.sendOtpBtn}
            onPress={() => onSendOtp(phoneDraft)}
            disabled={isBusy || phoneDraft.length < 10}
          >
            <Text style={[styles.sendOtpText, (isBusy || phoneDraft.length < 10) && { opacity: 0.5 }]}>
              {otpSent ? 'Resend OTP' : 'Send OTP'}
            </Text>
          </TouchableOpacity>

          {/* OTP Input */}
          <Text style={[styles.label, { marginTop: 16 }, !otpSent && { opacity: 0.5 }]}>OTP</Text>
          <TextInput
            style={[styles.input, !otpSent && { opacity: 0.5 }]}
            placeholder="Enter 6 digit otp"
            placeholderTextColor={theme.colors.ink500}
            keyboardType="number-pad"
            maxLength={6}
            value={otpDraft}
            onChangeText={onChangeOtp}
            editable={otpSent && !isBusy}
          />

          {/* Bottom Image */}
          <View style={styles.bottomImageContainer}>
            <Image source={IMG_2} style={styles.bottomImage} resizeMode="contain" />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, (!otpSent || otpDraft.length !== 6 || isBusy) && { opacity: 0.5 }]}
            onPress={() => onVerifyOtp(otpDraft)}
            disabled={!otpSent || otpDraft.length !== 6 || isBusy}
          >
            {isBusy ? <ActivityIndicator color="#FFF" /> : (
              <Text style={styles.primaryBtnText}>{isGoogleLinked ? 'Verify & Continue' : 'Sign in'}</Text>
            )}
          </TouchableOpacity>

          {!isGoogleLinked && (
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={onGoogleSignIn}
              disabled={isBusy}
            >
              <Image
                source={GOOGLE_LOGO}
                style={styles.googleIconImage}
                resizeMode="contain"
              />
              <Text style={styles.googleBtnText}>Sign in with google</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Form and bottom area is white
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  topSection: {
    height: 280,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    flexDirection: 'row',
    paddingTop: 80,
    paddingHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
  },

  headerTextContainer: {
    flex: 1,
    zIndex: 2,
    maxWidth: '55%',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#1C2434',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#4B5563',
    fontWeight: '500',
  },
  topImage: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    width: 200,
    height: 220,
    zIndex: 1,
  },
  formSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    fontSize: 16,
    color: '#111827',
    paddingVertical: 8,
    marginBottom: 12,
    fontWeight: '500',
  },
  sendOtpBtn: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  sendOtpText: {
    color: theme.colors.accentOrange, // #F5C116 or orange
    fontSize: 14,
    fontWeight: '700',
  },
  bottomImageContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  bottomImage: {
    width: 180,
    height: 140,
  },
  primaryBtn: {
    backgroundColor: theme.colors.accentOrange, // #F5C116
    borderRadius: 12,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.accentOrange,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryBtnText: {
    color: theme.colors.ink900,
    fontSize: 16,
    fontWeight: '800',
  },
  googleBtn: {
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    height: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconImage: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
