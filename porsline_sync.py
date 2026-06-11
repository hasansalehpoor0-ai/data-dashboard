import pandas as pd
import json
import sys
import traceback

# نام فایلی که از پرس‌لاین دانلود کرده‌اید
INPUT_EXCEL_FILE = 'porsline_data.xlsx'
OUTPUT_JSON_FILE = 'data.json'

def convert_excel_to_json():
    try:
        print(f"Starting to read {INPUT_EXCEL_FILE}...", flush=True)
        
        # خواندن فایل اکسل
        df = pd.read_excel(INPUT_EXCEL_FILE)
        print("Excel file loaded successfully.", flush=True)
        
        # تبدیل داده‌ها به دیکشنری
        data = df.to_dict(orient='records')
        
        # ذخیره به صورت JSON
        print(f"Saving data to {OUTPUT_JSON_FILE}...", flush=True)
        with open(OUTPUT_JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        print("Conversion completed successfully.", flush=True)
        
    except FileNotFoundError:
        print(f"Error: The file {INPUT_EXCEL_FILE} was not found. Please make sure it is in the same directory.", flush=True)
        sys.exit(1)
    except Exception as e:
        print("An unexpected error occurred:", flush=True)
        traceback.print_exc(file=sys.stdout)
        sys.exit(1)

if __name__ == '__main__':
    convert_excel_to_json()
