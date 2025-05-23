import logging
from urllib.parse import urlencode

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
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

@app.head("/google-auth-redirect")
async def head_auth_redirect():
    """Handle HEAD requests to the redirect endpoint"""
    logger.info("Received HEAD request to /google-auth-redirect")
    return Response(status_code=200)

@app.get("/google-auth-redirect")
async def auth_redirect(request: Request, test_mode: bool = False, source_app: str = None, dev_mode: bool = False):
    # Get all query parameters
    params = dict(request.query_params)
    
    # Remove test_mode and source_app from params if they exist
    if "test_mode" in params:
        del params["test_mode"]
    if "source_app" in params:
        source_app = params.pop("source_app")
    if "dev_mode" in params:
        dev_mode = params.pop("dev_mode") == "true"

    # Determine which app scheme to use
    app_scheme = "mobile"  # Default to mobile
    if source_app:
        app_scheme = source_app
    
    # Log the parameters (excluding sensitive data)
    safe_params = {k: '***' if k in ['code', 'access_token', 'id_token'] else v for k, v in params.items()}
    logger.info(f"Received auth redirect with params: {safe_params} for app: {app_scheme}")
    

    # If test_mode is True, just return the info instead of redirecting
    if test_mode:
        redirect_url = f"{app_scheme}://redirect?{urlencode(params)}"
        if dev_mode:
            redirect_url = f"exp://192.168.0.85:8081/--/redirect?{urlencode(params)}"
            
        return {
            "message": "Test mode - would redirect to:",
            "redirect_url": redirect_url,
            "params": safe_params,
            "app": app_scheme,
            "dev_mode": dev_mode
        }
    
    # Create the appropriate redirect URL based on dev_mode
    redirect_url = f"{app_scheme}://redirect?{urlencode(params)}"
    
    if dev_mode:
        redirect_url = f"exp://192.168.0.85:8081/--/redirect?{urlencode(params)}"
        logger.info(f"Using Expo development mode redirect to: {redirect_url}")
    else:
        logger.info(f"Using production redirect to: {redirect_url}")


    # For non-test mode, return an HTML page with JavaScript to help with deep linking
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Complete</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {{ font-family: Arial, sans-serif; text-align: center; padding: 20px; }}
        .button {{ background: #4285F4; color: white; padding: 12px 20px; 
                  border: none; border-radius: 4px; font-size: 16px; 
                  text-decoration: none; display: inline-block; margin-top: 20px; }}
        .code-box {{ 
            background: #eee; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px auto; 
            max-width: 80%; 
            font-family: monospace;
            font-size: 18px;
            word-break: break-all; 
            text-align: center; 
            border: 2px solid #ccc;
        }}
        #countdown {{ font-weight: bold; }}
    </style>
</head>
<body>
    <h2>Authentication Successful!</h2>
    
    <div id="codeSection">
        <h3>Your Authentication Code:</h3>
        <div class="code-box" onclick="copyToClipboard(this.innerText)">{params.get('code', '')}</div>
        <p>Click the code to copy. Return to app and paste this code.</p>
        
        <p id="redirectNotice">Automatic redirection in <span id="countdown">15</span> seconds...</p>
        <button onclick="redirectNow()" class="button">Redirect Now</button>
    </div>
    
    <script>
        function copyToClipboard(text) {{
            if (window.navigator && window.navigator.clipboard) {{
                window.navigator.clipboard.writeText(text).then(function() {{
                    alert('Code copied to clipboard!');
                }});
            }} else {{
                alert('Clipboard API not supported in this browser');
            }}
        }}
        
        let seconds = 15;
        const countdownElement = document.getElementById('countdown');
        
        const countdown = setInterval(function() {{
            seconds--;
            countdownElement.textContent = seconds;
            if (seconds <= 0) {{
                clearInterval(countdown);
                redirectToApp();
            }}
        }}, 1000);
        
        function redirectNow() {{
            clearInterval(countdown);
            redirectToApp();
        }}
        
        function redirectToApp() {{
            window.location.href = "{redirect_url}";
        }}
    </script>
</body>
</html>
"""
    
    logger.info(f"Returning HTML with deep link to: {redirect_url}")
    return HTMLResponse(content=html_content)

@app.get("/")
async def root():
    return {"message": "Auth Redirect Service Running", "endpoints": ["/google-auth-redirect"]}
