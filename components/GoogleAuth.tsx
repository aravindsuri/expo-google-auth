import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, Image, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Required for Expo auth callbacks
WebBrowser.maybeCompleteAuthSession();

// Types for TypeScript
interface UserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

interface GoogleAuthProps {
  onAuthStateChange?: (isAuthenticated: boolean, userInfo: UserInfo | null) => void;
}

// Configure your Google OAuth credentials
const CLIENT_ID = '870686466844-b48vci0sqn5qado9khbu9s7pqbo3mk1p.apps.googleusercontent.com';
const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'expogoogleauth'
});

console.log('REDIRECT_URI:', REDIRECT_URI);

// Persist auth to storage
const STORAGE_KEY = 'google_auth_token';

const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthStateChange }) => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: CLIENT_ID,
      responseType: 'token',
      scopes: ['profile', 'email'],
      redirectUri: REDIRECT_URI,
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  // Check for stored auth token on component mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        if (jsonValue) {
          const token = JSON.parse(jsonValue);
          // If we have a token, fetch user info
          if (token?.accessToken) {
            fetchUserInfo(token.accessToken);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to load auth from storage', e);
        setLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  // Handle auth response changes
  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      // Store the token
      storeToken({ accessToken: access_token });
      // Fetch user info with the token
      fetchUserInfo(access_token);
    } else if (response?.type === 'error') {
      setError(response.params.error || 'Authentication failed');
      setLoading(false);
    }
  }, [response]);

  // Notify parent component when auth state changes
  useEffect(() => {
    if (onAuthStateChange) {
      onAuthStateChange(!!userInfo, userInfo);
    }
  }, [userInfo, onAuthStateChange]);

  // Store auth token in AsyncStorage
  const storeToken = async (tokenData: { accessToken: string }) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokenData));
    } catch (e) {
      console.error('Failed to save auth token', e);
    }
  };

  // Fetch user info from Google
  const fetchUserInfo = async (accessToken: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (response.ok) {
        const userInfo = await response.json();
        setUserInfo(userInfo);
      } else {
        // If response is not OK, handle error
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch user info');
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      setError(error instanceof Error ? error.message : String(error));
      // Clear stored token if it's invalid
      await AsyncStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    setUserInfo(null);
    setError(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}

      {userInfo ? (
        <View style={styles.userContainer}>
          <Image source={{ uri: userInfo.picture }} style={styles.profilePic} />
          <Text style={styles.userName}>Welcome, {userInfo.name}!</Text>
          <Text style={styles.userEmail}>{userInfo.email}</Text>
          <Button title="Sign Out" onPress={handleSignOut} color="#DB4437" />
        </View>
      ) : (
        <View style={styles.authContainer}>
          <Text style={styles.instructions}>
            Sign in with your Google account.
          </Text>
          <Text style={styles.redirectText}>
            Redirect URI: {REDIRECT_URI}
          </Text>
          <Button
            title="Sign in with Google"
            disabled={!request}
            onPress={() => {
              console.log('Attempting Google sign-in...');
              promptAsync({ showInRecents: true })
                .then(result => {
                  console.log('Auth result:', result);
                })
                .catch(error => {
                  console.error('Auth error:', error);
                });
            }}
            color="#4285F4"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  instructions: {
    textAlign: 'center',
    marginBottom: 20,
  },
  redirectText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  authContainer: {
    width: '100%',
    alignItems: 'center',
  },
  userContainer: {
    alignItems: 'center',
  },
  profilePic: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userEmail: {
    marginBottom: 20,
    color: '#666',
  },
  loadingText: {
    marginTop: 10,
  },
  error: {
    color: 'red',
    marginBottom: 10,
  },
});

export default GoogleAuth;