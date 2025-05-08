import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';

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

interface LinkingEvent {
  url: string;
}

// Configure your Google OAuth credentials
const CLIENT_ID = '870686466844-b48vci0sqn5qado9khbu9s7pqbo3mk1p.apps.googleusercontent.com';
const REDIRECT_URI = 'https://teluu.onrender.com/google-auth-redirect';

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
        responseType: 'code',  // Changed from 'token' to 'code'
        scopes: ['profile', 'email'],
        redirectUri: REDIRECT_URI,
      },
      { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
    );

    useEffect(() => {
      // Configure linking
      const handleRedirect = (event: LinkingEvent) => {
        console.log("Received deep link:", event.url);
        
        // Extract authorization data from URL
        const data = Linking.parse(event.url);
        console.log("Parsed link data:", data);
        
        // Handle the authorization code
        if (data.queryParams && data.queryParams.code) {
          console.log("Received auth code from deep link");
          // Here you'd normally exchange this code for tokens
          // For now, we'll simulate success
          const mockUserInfo = {
            id: 'demo-user-id',
            name: 'Test User',
            email: 'test@example.com',
            picture: 'https://ui-avatars.com/api/?name=Test+User&background=random',
            verified_email: true,
            given_name: 'Test',
            family_name: 'User',
            locale: 'en'
          };
          setUserInfo(mockUserInfo);
        }
    };

  const subscription = Linking.addEventListener('url', handleRedirect);

  // Check for initial URL that may have launched the app
  Linking.getInitialURL().then(url => {
    if (url) {
      console.log("App opened with initial URL:", url);
      handleRedirect({ url });
    }
  });

  // Clean up
  return () => {
    subscription.remove();
  };
}, []);

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
      const { code } = response.params;
      console.log('Auth successful! Received authorization code:', code);
      
      // In a real app, you would exchange this code for tokens via a server
      // For demo purposes, simulate getting a token from the code
      const simulatedTokenExchange = async () => {
        try {
          // Simulate API delay
          setLoading(true);
          
          // In a real implementation, you would make a request to your backend
          // which would exchange the code for tokens using Google's token endpoint
          
          // Simulate a successful token response
          const mockTokenResponse = {
            access_token: `mock_token_${Date.now()}`,
            id_token: 'mock_id_token',
            expires_in: 3600
          };
          
          // Store the token
          storeToken({ accessToken: mockTokenResponse.access_token });
          
          // Use the token to fetch user info (or use mock data)
          const mockUserInfo: UserInfo = {
            id: 'demo-user-id',
            name: 'Test User',
            email: 'test@example.com',
            picture: 'https://ui-avatars.com/api/?name=Test+User&background=random',
            verified_email: true,
            given_name: 'Test',
            family_name: 'User',
            locale: 'en'
          };
          
          setUserInfo(mockUserInfo);
        } catch (error) {
          console.error('Error in token exchange:', error);
          setError('Failed to exchange code for token');
        } finally {
          setLoading(false);
        }
      };
      
      simulatedTokenExchange();
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

  const attemptSignIn = async () => {
    console.log('Attempting Google sign-in with config:');
    console.log('- Client ID:', CLIENT_ID.substring(0, 8) + '...');
    console.log('- Redirect URI:', REDIRECT_URI);
    
    try {
      const result = await promptAsync();
      console.log('Auth result type:', result.type);
      
      // Check if the user canceled the flow
      if (result.type === 'cancel') {
        console.log('User canceled the authentication');
      } 
      // Check for dismiss (user closed the browser)
      else if (result.type === 'dismiss') {
        console.log('Authentication dismissed');
      }
      // Check for success but with possible error
      else if (result.type === 'success') {
        if (result.params.error) {
          console.error('Auth succeeded but with error:', result.params.error);
        } else {
          console.log('Auth succeeded with token');
        }
      }
      // Log the full result
      console.log('Full auth result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

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
            onPress={attemptSignIn}
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