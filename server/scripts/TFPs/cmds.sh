# arguments are sometimes needed for a reasonable result
pdf2txt -M 30 -W .95 -L .03 cwave14.pdf > cwave14.txt
pdf2txt cwave15.pdf > cwave15.txt
pdf2txt cwave16.pdf > cwave16.txt
pdf2txt pwave_ts.pdf > pwave_ts.txt
pdf2txt caribe_annex.pdf > caribe_annex.txt
pdf2txt -M 30 -W .95 -L .03 ptws.pdf | grep -E "JUN|AUG|SEP" > ptws.txt

# create pwave16_table.txt manually by copying the contents of Table 1 from page 13f of pwave16.pdf
# afterwards, run the following command
cat pwave16_table.txt | tr '\n' '@' | sed 's/@/  /g' | sed -r 's/([0-9]+)  /\1\n/g' > pwave16.txt

# create pwave_table.txt manually by copying the contents of Table ? on page 57(63) from pwave_ts.pdf
# create ptws_table.txt manually by copying the contents of Table 4.3 on page 38(50) from ptws.pdf

python3 ./extract.py cwave14.txt -cw14 #-w
python3 ./extract.py cwave15.txt -cw15 #-w
python3 ./extract.py cwave16.txt -cw16 #-w
python3 ./extract.py caribe_annex.txt -cw16 #-w

python3 ./extract.py pwave16.txt -pw16 #-w
python3 ./extract.py pwave_table.txt -pw16 #-w
python3 ./extract.py pwave_ts.txt -cw16 #-w
python3 ./extract.py ptws_table.txt -cw16 #-w
python3 ./extract.py ptws.txt -pw16 #-w

# gauge locations
python3 ./gauge.py cwave16.txt -gauge -dist 0.1 -v #-w
