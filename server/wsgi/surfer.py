#!/usr/bin/env python3
import sys
import os
import struct

class NotASurferFile(Exception):
    pass
class NotASurferBinaryFile(NotASurferFile):
    pass

class SurferFile:
    cols=0
    rows=0
    xmin=0.0
    xmax=0.0
    ymin=0.0
    ymax=0.0
    zmin=0.0
    zmax=0.0
    def __init__(self,sfile=sys.stdin):
        if sfile is not None:
            self.sfile=sfile
            if sfile.peek(4)[:4]==b'DSAA':
                print("Ascii Surfer not supported.")
                raise NotASurferBinaryFile
            elif sfile.peek(4)[:4]==b'DSBB':
                self.readSurferBin(sfile)
            elif sfile.peek(4)[:4]==b'DSXX':
                self.readSurferBigBin(sfile)
            else:
                raise NotASurferFile

    def readSurferBin(self,inp):
        fmt="ccccHHdddddd"
        self.headersize=struct.calcsize(fmt)
        buf=inp.read(struct.calcsize(fmt))
        buf=struct.unpack(fmt,buf)
        if buf[0]==b'D' and buf[1]==b'S' and buf[2]==b'B' and buf[3]==b'B':
            self.cols=buf[4]
            self.rows=buf[5]
            self.xmin=buf[6]
            self.xmax=buf[7]
            self.ymin=buf[8]
            self.ymax=buf[9]
            self.zmin=buf[10]
            self.zmax=buf[11]
        else:
            raise NotASurferBinaryFile

    def readSurferBigBin(self,inp):
        fmt="ccccIIdddddd"
        self.headersize=struct.calcsize(fmt)
        buf=inp.read(struct.calcsize(fmt))
        buf=struct.unpack(fmt,buf)
        if buf[0]==b'D' and buf[1]==b'S' and buf[2]==b'B' and buf[3]==b'B':
            self.cols=buf[4]
            self.rows=buf[5]
            self.xmin=buf[6]
            self.xmax=buf[7]
            self.ymin=buf[8]
            self.ymax=buf[9]
            self.zmin=buf[10]
            self.zmax=buf[11]
        else:
            raise NotASurferBinaryFile

    def getColWidth(self):
        return (self.xmax-self.xmin)/(self.cols-1)
    def getRowHeight(self):
        return (self.ymax-self.ymin)/(self.rows-1)
    def getValueAt(self,row,col):
        if row<0 or col<0 or row>=self.rows or col>=self.cols:
            return None
        else:
            fmt="f"
            fmtsize=struct.calcsize(fmt)
            self.sfile.seek(self.headersize+((row*self.cols+col)*fmtsize))
            value=struct.unpack(fmt,self.sfile.read(fmtsize))[0]
            return value
    def getRow(self,row):
        if row<0 or row>=self.rows:
            return None
        else:
            fmt="f"
            fmtsize=struct.calcsize(fmt)
            self.sfile.seek(self.headersize+((row*self.cols)*fmtsize))
            value=struct.unpack(fmt*self.cols,self.sfile.read(fmtsize*self.cols))
            return value
    def getLatLonFromRowCol(self,row,col):
        lat=row*self.getRowHeight()+self.ymin
        lon=col*self.getColWidth()+self.xmin
        return (lat,lon)
    def getRowColFromLatLon(self,lat,lon):
        xpos=round((lon-self.xmin)/self.getColWidth())
        ypos=round((lat-self.ymin)/self.getRowHeight())
        return ypos,xpos
    def getValueAtLatLon(self,lat,lon):
        ypos,xpos=self.getRowColFromLatLon(lat,lon)
        return self.getValueAt(ypos,xpos)

