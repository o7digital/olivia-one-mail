"""Run only on the Olivia VPS. Creates tenant-scoped service credentials; never prints secrets."""
import json, os, pathlib, secrets, subprocess

root = pathlib.Path('/opt/o7/olivia-one-v3-test')
root.mkdir(mode=0o700, parents=True, exist_ok=True)
secret_path = root / '.env.v3-test'
if secret_path.exists():
    raise SystemExit('Test secret configuration already exists; reuse it rather than reprovisioning')
# Bootstrap/login/create service user through the frozen V3 HTTP API, not database writes.
program = r'''
import json, os, secrets, urllib.request, urllib.error
base='http://127.0.0.1:8093'
tenant='o7-internal-test'
owner_password=secrets.token_urlsafe(36)
service_password=secrets.token_urlsafe(36)
def call(path, body, extra=None):
 headers={'Content-Type':'application/json','X-Tenant-ID':tenant,**(extra or {})}
 req=urllib.request.Request(base+path,data=json.dumps(body).encode(),headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=15) as res: return json.load(res)
 except urllib.error.HTTPError as e: raise RuntimeError(f'Provisioning {path} failed with HTTP {e.code}') from None
owner='olivia-one-test-owner@o7digitalgroup.com'
service='olivia-one-test-gateway@o7digitalgroup.com'
call('/v1/auth/bootstrap',{'email':owner,'password':owner_password},{'X-Bootstrap-Key':os.environ['BOOTSTRAP_KEY']})
token=call('/v1/auth/login',{'email':owner,'password':owner_password})['access_token']
created=call('/v1/auth/users',{'email':service,'password':service_password,'role':'service'},{'Authorization':'Bearer '+token})
print(json.dumps({'owner':owner,'owner_password':owner_password,'service':service,'password':service_password,'service_id':created['user_id']}))
'''
credentials = json.loads(subprocess.check_output(['docker','exec','olivia-v3','python','-c',program]))
# Record owner recovery credentials outside Git before configuring the gateway.
vault=root/'tenant-owner.json'
fd=os.open(vault,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: json.dump(credentials,f)
live = json.loads(subprocess.check_output(['docker','inspect','olivia-one-mail-olivia-gateway-1']))[0]
original=dict(item.split('=',1) for item in live['Config']['Env'])
config={k:v for k,v in original.items() if k.startswith('MAIL_') and k != 'MAIL_PROVIDER'}
config.update({
 'AI_PROVIDER':'python-olivia','AI_API_URL':original.get('AI_API_URL',''),
 'AI_MAILBOX_CLIENT_MAP':json.dumps({'info@o7digitalgroup.com':'o7-internal-test'}),
 'AI_DOMAIN_CLIENT_MAP':'{}','AI_V3_TEST_ONLY':'true',
 'AI_V3_TEST_MAILBOX':'info@o7digitalgroup.com','AI_V3_TEST_TENANT':'o7-internal-test',
 'AI_V3_API_URL':'http://olivia-v3:8093','AI_V3_SERVICE_EMAIL':credentials['service'],
 'AI_V3_SERVICE_PASSWORD':credentials['password'],'AI_V3_TIMEOUT_MS':'90000','AI_V3_POLL_MS':'250',
 'MAIL_PROVIDER':'mailcow-imap','APP_ORIGIN':'https://one.o7digitalgroup.com',
 'COOKIE_SECRET':secrets.token_hex(32),'PORT':'8787','HOST':'0.0.0.0',
 'TASK_DATA_PATH':'/data/tasks.json','INTELLIGENCE_DATA_PATH':'/data/intelligence.json',
})
fd=os.open(secret_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:
 for k,v in config.items():
  if '\n' in v or '\r' in v: raise ValueError('Invalid multiline environment value')
  f.write(k+'='+v+'\n')
print(json.dumps({'tenant':'o7-internal-test','mailbox':'info@o7digitalgroup.com','service_role':'service','configured':True}))
