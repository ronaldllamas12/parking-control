import json
import urllib.request

url = 'http://127.0.0.1:8001/api/v1/auth/webauthn/assertion/options'
data = json.dumps({'username': 'admin'}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        print('Status:', resp.status)
        print(resp.read().decode())
except Exception as e:
    print('Error:', e)
    import traceback
    traceback.print_exc()
