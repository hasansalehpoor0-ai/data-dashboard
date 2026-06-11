import os
import json
import urllib.request
from urllib.error import HTTPError, URLError
import sys

# Configuration
# سعی می کند کلید را از گیت هاب بخواند، در غیر این صورت از کلیدی که دادید استفاده می کند
API_KEY = os.environ.get('PORSLINE_API_KEY', '01a1f7586fc963fa639463569b827a78f78f00ff')
SURVEY_ID = '2533005'
OUTPUT_FILE = 'data.json'

def fetch_data():
    # آدرس API پرس لاین اصلاح شد
    url = f'https://survey.porsline.ir/api/v1/surveys/{SURVEY_ID}/responses/'
    headers = {
        'Authorization': f'API-Key {API_KEY}',
        'Content-Type': 'application/json'
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=4)
                
                print("Data fetched and saved successfully.")
            else:
                print(f"Failed to fetch data. Status code: {response.status}")
                sys.exit(1)
                
    except HTTPError as e:
        print(f"HTTP Error: {e.code} - {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            print(f"Error details: {error_body}")
        except:
            pass
        sys.exit(1)
    except URLError as e:
        print(f"URL Error: {e.reason}")
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)

if __name__ == '__main__':
    if not API_KEY:
        print("Error: PORSLINE_API_KEY environment variable not set.")
        sys.exit(1)
    else:
        fetch_data()
