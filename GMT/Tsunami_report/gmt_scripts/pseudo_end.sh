#!/bin/bash

output=${1}

R=${2}
J=${3}

#PseudoCommand; beendet das Overlay; Plottet unsichtbare Flüsse/Seen
gmt pscoast ${R} ${J} -P -O -C-t100 -Y >> ${output}