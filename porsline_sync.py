import os
import json
import urllib.request

# Configuration
API_KEY = os.environ.get('PORSLINE_API_KEY')
SURVEY_ID = '2533005'
OUTPUT_FILE = 'data.json'

def fetch_data():
    url = f'https://api.porsline.ir/v1/surveys/{SURVEY_ID}/responses/'
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
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    if not API_KEY:
        print("Error: PORSLINE_API_KEY environment variable not set.")
    else:
        fetch_data()
