from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import urlencode
import logging

from starlette.routing import Route

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Auth Redirect Service",
    # This enables automatic HEAD handlers for GET routes
    routes=[
        Route("/{path:path}", endpoint=lambda request: None, methods=["HEAD"])
    ]
)

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
    # Get all query parameters
    params = dict(request.query_params)
    
    # Remove test_mode from params if it exists
    if "test_mode" in params:
        del params["test_mode"]
    
    # Log the parameters (excluding sensitive data)
    safe_params = {k: '***' if k in ['code', 'access_token', 'id_token'] else v for k, v in params.items()}
    logger.info(f"Received auth redirect with params: {safe_params}")
    
    # If test_mode is True, just return the info instead of redirecting
    if test_mode:
        return {
            "message": "Test mode - would redirect to:",
            "redirect_url": f"expogoogleauth://redirect?{urlencode(params)}",
            "params": safe_params
        }
    
    # For non-test mode, return an HTML page with JavaScript to help with deep linking
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Redirecting to App</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body {{ font-family: Arial, sans-serif; text-align: center; padding: 20px; }}
            .button {{ background: #4285F4; color: white; padding: 12px 20px; 
                      border: none; border-radius: 4px; font-size: 16px; 
                      text-decoration: none; display: inline-block; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <h2>Authentication Successful!</h2>
        <p>Redirecting back to the app...</p>
        
        <div id="manual" style="display: none; margin-top: 30px;">
            <p>If you're not automatically redirected, click the button below:</p>
            <a href="expogoogleauth://redirect?{urlencode(params)}" class="button">
                Return to App
            </a>
        </div>
        
        <script>
            // Try to open the app with the custom scheme
            window.location.href = "expogoogleauth://redirect?{urlencode(params)}";
            
            // Show manual button after a short delay
            setTimeout(function() {{
                document.getElementById('manual').style.display = 'block';
            }}, 2000);
        </script>
    </body>
    </html>
    """
    
    logger.info(f"Returning HTML with deep link to: expogoogleauth://redirect?[params]")
    return HTMLResponse(content=html_content)

@app.get("/")
async def root():
    return {"message": "Auth Redirect Service Running", "endpoints": ["/google-auth-redirect"]}
