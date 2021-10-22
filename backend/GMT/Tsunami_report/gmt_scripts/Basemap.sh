#!/bin/bash

# GeoPeril - A platform for the computation and web-mapping of hazard specific
# geospatial data, as well as for serving functionality to handle, share, and
# communicate threat specific information in a collaborative environment.
#
# Copyright (C) 2021 GFZ German Research Centre for Geosciences
#
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the Licence is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the Licence for the specific language governing permissions and
# limitations under the Licence.
#
# Contributors:
#   Johannes Spazier (GFZ)
#   Sven Reissland (GFZ)
#   Martin Hammitzsch (GFZ)
#   Matthias Rüster (GFZ)
#   Hannes Fuchs (GFZ)

#########################
# passed arguments

# ./Basemap.sh title output extent projection y_map_dist basemap
# basemap_hillshade outline coast_res coast_color dem(terrain) color_water
# color_land color_globe_land color_globe_water land_res basemap_water_cpt
# basemap_land_cpt

title=${1}
output=${2}

extent=${3}

projection=${4}

y_map_dist=${5}

basemap=${6}
basemap_hillshade=${7}

outline=${8}
coast_res=${9}
coast_color=${10}
# dem = digital elevation modell
dem=${11}

color_water=${12}
color_land=${13}

color_globe_land=${14}
color_globe_water=${15}

land_res=${16}

basemap_water_cpt=${17}
basemap_land_cpt=${18}

world_pop_data=${19}
world_pop_cpt=${20}
world_pop=${21}

subtitle=${22}
paper_height=${23}

border=${24}
border_color=${25}


#######################################
############ Basemap ##################
#######################################

gmt_defaults="--MAP_FRAME_TYPE=plain --PS_MEDIA=21.0cx${paper_height}c"

if [ "${title}" == "None" ]; then
    # Erstellt leeren Kartenrahmen; -BWSen (Sued und West-Achse werden
    # beschriften, Nord und Ost nur geplottet);fuegt Titel an Karte falls
    # eingestellt
    gmt psbasemap \
        ${gmt_defaults} \
        --MAP_ANNOT_OFFSET_PRIMARY=3p \
        --MAP_ANNOT_OFFSET_SECONDARY=3p \
        --FONT_ANNOT_PRIMARY=8p,Helvetica,black \
        ${projection} \
        ${extent} \
        -P -Ba -BNWes \
        -Ya${y_map_dist} \
        -V -K \
        > ${output}
else
    if [ "${subtitle}" == "None" ]; then
        gmt psbasemap \
            ${gmt_defaults} \
            --MAP_ANNOT_OFFSET_PRIMARY=3p \
            --MAP_ANNOT_OFFSET_SECONDARY=3p \
            --FONT_ANNOT_PRIMARY=8p,Helvetica,black \
            --FONT_TITLE=22p,Helvetica-Bold,black \
            --MAP_TITLE_OFFSET=14p \
            ${projection} \
            ${extent} \
            -P -Ba \
            -BNWes+t"${title}" \
            -Ya${y_map_dist} \
            -V -K \
            > ${output}
    else
        gmt psbasemap \
            ${gmt_defaults} \
            --MAP_ANNOT_OFFSET_PRIMARY=3p \
            --MAP_ANNOT_OFFSET_SECONDARY=3p \
            --FONT_ANNOT_PRIMARY=8p,Helvetica,black \
            --FONT_TITLE=22p,Helvetica-Bold,black \
            --MAP_TITLE_OFFSET=25p \
            ${projection} \
            ${extent} \
            -P -Ba \
            -BNWes+t"${title}" \
            -Ya${y_map_dist} \
            -V -K \
            > ${output}
    fi
fi

if [ ${dem} == "Y" ] || [ ${dem} == "water_only" ]; then
    # erstellt eine Basemap auf Grundlage von ETOPO-Daten
    # erstellt meer mit hillshade;
    gmt grdimage \
        ${gmt_defaults} \
        -J -R -P -V -K -O \
        ${basemap} \
        -I${basemap_hillshade} \
        -C${basemap_water_cpt} \
        -Y \
        >> ${output}

    # Anfang clip Land "-Gc"; "-D" fuer Aufloesung der Kuestenlinien
    gmt pscoast \
        ${gmt_defaults} \
        -J -R -P -V -K -O \
        -D${coast_res} \
        -A${land_res} \
        -Gc -Y \
        >> ${output}

    if [ ${world_pop} == "Y" ]; then
        gmt grdimage \
            ${gmt_defaults} \
            -J -R -P -V -K -O \
            -C${world_pop_cpt} \
            ${world_pop_data} \
            -Y \
            >> ${output}
    else
        if [ ${dem} == "water_only" ]; then
            gmt pscoast \
                ${gmt_defaults} \
                -J -R -P \
                -D${coast_res} \
                -A${land_res} \
                -S${color_water} \
                -G${color_land} \
                -Ya${y_map_dist} \
                -V -K -O \
                >> ${output}
        else
            # erstellt land mit hillshade
            gmt grdimage \
                ${gmt_defaults} \
                -J -R -P -V -K -O \
                -C${basemap_land_cpt} \
                ${basemap} \
                -I${basemap_hillshade} \
                -Y \
                >> ${output}
        fi
    fi

    # Ende Clip Land "-Q"
    gmt pscoast ${gmt_defaults} -J -R -P -V -K -O -Q -Y >> ${output}
elif [ ${dem} == "N" ]; then
    # Erstellt einfache zweifarbe Basemap
    if [ ${world_pop} == Y ]; then
        gmt grdimage \
            ${gmt_defaults} \
            -J -R -P -V -K -O \
            -C${world_pop_cpt} \
            ${world_pop_data} \
            -Y \
            >> ${output}

        gmt pscoast \
            ${gmt_defaults} \
            -J -R -P -V -O -K \
            -D${coast_res} \
            -A${land_res} \
            -S${color_water} \
            -Y \
            >> ${output}
    else
        gmt pscoast \
            ${gmt_defaults} \
            -J -R -P \
            -D${coast_res} \
            -A${land_res} \
            -S${color_water} \
            -G${color_land} \
            -Ya${y_map_dist} \
            -V -K -O \
            >> ${output}
    fi
fi

# print outlines
if [ ${outline} == Y ]; then
    gmt pscoast \
        ${gmt_defaults} \
        -J -R -P \
        -D${coast_res} \
        -A${land_res} \
        -W0.009c,${coast_color} \
        ${borders} \
        -Ya${y_map_dist} \
        -V -K -O \
        >> ${output}
fi

if [ ${border} == Y ]; then
    gmt pscoast \
        ${gmt_defaults} \
        -J -R -P \
        -D${coast_res} \
        -A${land_res} \
        ${border_color} \
        -Ya${y_map_dist} \
        -V -K -O \
        >> ${output}
fi
