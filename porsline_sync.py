import os
import json
import urllib.request
from urllib.error import HTTPError, URLError
import sys
import traceback

# Configuration
API_KEY = os.environ.get('PORSLINE_API_KEY', '01a1f7586fc963fa639463569b827a78f78f00ff')
SURVEY_ID = '2533005'
OUTPUT_FILE = 'data.json'

def fetch_data():
    print("Starting data sync process...", flush=True)
    url = f'https://survey.porsline.ir/api/v1/surveys/{SURVEY_ID}/responses/'
    headers = {
        'Authorization': f'API-Key {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        print(f"Sending request to {url}...", flush=True)
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print("Response received with status 200. Parsing JSON...", flush=True)
                data = json.loads(response.read().decode('utf-8'))
                
                print("Data parsed successfully. Saving to file...", flush=True)
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                
                print("Data fetched and saved successfully.", flush=True)
            else:
                print(f"Failed to fetch data. Status code: {response.status}", flush=True)
                sys.exit(1)
                
    except HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}", flush=True)
        try:
            error_body = e.read().decode('utf-8')
            print(f"Error details: {error_body}", flush=True)
        except:
            pass
        sys.exit(1)
    except URLError as e:
        print(f"URL Error: {e.reason}", flush=True)
        sys.exit(1)
    except Exception as e:
        print("An unexpected error occurred during fetch_data:", flush=True)
        traceback.print_exc(file=sys.stdout)
        sys.exit(1)

if __name__ == '__main__':
    try:
        print("Script execution started.", flush=True)
        if not API_KEY:
            print("Error: PORSLINE_API_KEY is empty or not set.", flush=True)
            sys.exit(1)
        else:
            fetch_data()
    except Exception as e:
        print("Fatal error in main block:", flush=True)
        traceback.print_exc(file=sys.stdout)
        sys.exit(1)
