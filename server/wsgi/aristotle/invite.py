import urllib.parse
import urllib.request
import csv
import sys
import json

def invite_script(fname, apikey, text):
    with open(fname, 'r') as fcsv:
        reader = csv.reader(fcsv, delimiter='\t')
        for row in reader:
            if not row:
                continue
            keys = ["name", "mail", "phone", "inst_acronym", "inst_name", "office_name", "cc", "from"]
            data = {}
            for i in range(0, len(keys)):
                data[keys[i]] = row[i]
            data = {
                "data": json.dumps(data),
                "text": text,
                "apikey": apikey
            }
            print(data)
            res = urllib.request.urlopen(
                urllib.request.Request('http://trideccloud.gfz-potsdam.de/aristotel/invite'),
                bytes(urllib.parse.urlencode(data), 'utf-8')
            ).read()
            print(res)

with open(sys.argv[3], 'r') as f:
    invite_script(sys.argv[1], sys.argv[2], f.read())
