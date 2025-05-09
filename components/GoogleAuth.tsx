import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, TextInput, View } from 'react-native';

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

console.log('Using Expo auth proxy for authentication');

// Persist auth to storage
const STORAGE_KEY = 'google_auth_token';

  const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthStateChange }) => {
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [manualCode, setManualCode] = useState('');

   // Use Google's discovery document for proper endpoints
    const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

    const REDIRECT_URI = 'https://teluu.onrender.com/google-auth-redirect?source_app=expogoogleauth';
    console.log('Using custom redirect URI:', REDIRECT_URI);

    // Store auth token in AsyncStorage
    const storeToken = useCallback(async (tokenData: { accessToken: string }) => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokenData));
      } catch (e) {
        console.error('Failed to save auth token', e);
      }
    }, []);

    const simulatedTokenExchange = useCallback(async (authCode: string) => {
      try {
        setLoading(true);
        
        // Mock token response and rest of the function...
        const mockTokenResponse = {
          access_token: `mock_token_${Date.now()}`,
          id_token: 'mock_id_token',
          expires_in: 3600
        };
        
        storeToken({ accessToken: mockTokenResponse.access_token });
        
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
    }, [setLoading, setUserInfo, setError, storeToken]);
  
    const [request, response, promptAsync] = AuthSession.useAuthRequest(
      {
        clientId: CLIENT_ID,
        responseType: 'code',
        scopes: ['profile', 'email'],
        redirectUri: REDIRECT_URI
      },
      discovery
    );

    useEffect(() => {
      const handleDeepLink = (event: { url: string }) => {
        console.log("Deep link received:", event.url);
        
        try {
          // Parse the URL
          const parsedUrl = Linking.parse(event.url);
          console.log("Parsed deep link:", parsedUrl);
          
          // Check if there's an auth code
          if (parsedUrl.queryParams && parsedUrl.queryParams.code) {
            console.log("Found code in deep link:", parsedUrl.queryParams.code);
            simulatedTokenExchange(parsedUrl.queryParams.code as string);
          }
        } catch (error) {
          console.error("Error handling deep link:", error);
        }
      };

      const subscription = Linking.addEventListener('url', handleDeepLink);

      Linking.getInitialURL().then(url => {
        if (url) {
          console.log("App opened with URL:", url);
          handleDeepLink({ url });
        }
      });
      
      // Clean up
      return () => {
        subscription.remove();
      };
    }, [simulatedTokenExchange]);
    
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
      
      // Use the standalone function
      simulatedTokenExchange(code);
    } else if (response?.type === 'error') {
      console.error('Auth error details:', response.params);
      setError(response.params.error || 'Authentication failed');
      setLoading(false);
    } else if (response?.type === 'cancel') {
      console.log('Auth was canceled');
      setLoading(false);
    }
  }, [response, simulatedTokenExchange]);

  // Notify parent component when auth state changes
  useEffect(() => {
    if (onAuthStateChange) {
      onAuthStateChange(!!userInfo, userInfo);
    }
  }, [userInfo, onAuthStateChange]);

  

  // Handle manual code submission
  const handleManualCodeSubmit = () => {
    if (!manualCode || manualCode.trim() === '') {
      setError('Please enter an authentication code');
      return;
    }
    
    console.log('Processing manual auth code:', manualCode);
    
    // Use the standalone function with the manual code
    simulatedTokenExchange(manualCode);
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
    console.log('Attempting Google sign-in with Expo proxy');
    console.log('- Client ID:', CLIENT_ID.substring(0, 8) + '...');
  
    setLoading(true);

    try {
      // Use the proxy option for reliable auth in Expo Go
      const result = await promptAsync();
      console.log('Auth result type:', result.type);
      
       if (result.type === 'cancel') {
      console.log('User canceled the authentication');
      setLoading(false); // Reset loading state for cancel
    } else if (result.type === 'dismiss') {
      console.log('Authentication dismissed');
      setLoading(false); // Reset loading state for dismiss
    } else if (result.type === 'success') {
      if (result.params.error) {
        console.error('Auth succeeded but with error:', result.params.error);
        setError(result.params.error);
        setLoading(false); // Reset loading state for error
      } else {
        console.log('Auth succeeded with code');
        // Success case loading is handled in the useEffect
      }
    }
      
      console.log('Full auth result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Auth error:', error);
      setError('Authentication failed: ' + (error instanceof Error ? error.message : String(error)));
      setLoading(false);
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
            Using Custom Redirect Service
          </Text>
          <Button
            title="Sign in with Google"
            disabled={!request}
            onPress={attemptSignIn}
            color="#4285F4"
          />

      <Text style={styles.instructions}>
            Enter authentication code manually
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Paste authentication code here"
            value={manualCode}
            onChangeText={setManualCode}
          />
          <Button
            title="Submit Code"
            onPress={handleManualCodeSubmit}
            color="#34A853"
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
  input: {
    width: '100%',
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  separatorText: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    color: '#666',
  },
});

export default GoogleAuth;