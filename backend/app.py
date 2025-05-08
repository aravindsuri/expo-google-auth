from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urlencode
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Auth Redirect Service")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/google-auth-redirect")
async def auth_redirect(request: Request, test_mode: bool = False):
    """
    Receive the OAuth response from Google and redirect to the Expo app
    """
    # Log the full request details
    logger.info(f"Request URL: {request.url}")
    logger.info(f"Request headers: {dict(request.headers)}")
    logger.info(f"Query parameters: {dict(request.query_params)}")
    
    # Get all query parameters
    params = dict(request.query_params)
    
    # Remove test_mode from params if it exists
    if "test_mode" in params:
        del params["test_mode"]
    
    # Log the parameters (excluding sensitive data)
    safe_params = {k: '***' if k in ['code', 'access_token', 'id_token'] else v for k, v in params.items()}
    logger.info(f"Received auth redirect with params: {safe_params}")
    
    # If no parameters were provided, log a warning
    if not params:
        logger.warning("No parameters received in redirect - possible authentication cancelation or error")
    
    # Construct the redirect URL to your Expo app
    redirect_url = f"expogoogleauth://redirect?{urlencode(params)}"
    
    # If test_mode is True, just return the info instead of redirecting
    if test_mode:
        return {
            "message": "Test mode - would redirect to:",
            "redirect_url": redirect_url,
            "params": safe_params
        }
    
    logger.info(f"Redirecting to: expogoogleauth://redirect?[params]")
    return RedirectResponse(url=redirect_url)

@app.get("/")
async def root():
    return {"message": "Auth Redirect Service Running", "endpoints": ["/google-auth-redirect"]}
