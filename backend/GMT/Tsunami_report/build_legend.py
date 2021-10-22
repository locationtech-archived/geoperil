#!/usr/bin/env python3

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


def calc_legend_for_wt_TC_wp_c(plot_legend_list):
    # plot_legend_list2 = [
    #     plot_wave_time, world_pop, plot_cities, plot_cfz_tfp
    # ]
    plot_legend_list2 = [
        plot_legend_list[1],
        plot_legend_list[2],
        plot_legend_list[3],
        plot_legend_list[4],
    ]

    world_pop_pslegend_x, world_pop_psscale_1_x, world_pop_psscale_2_x = \
        0, 0, 0
    cities_pslegend_x = 0
    wave_time_pslegend_x = 0
    tfp_cfz_pslegend_x, tfp_cfz_psscale_1_x, tfp_cfz_psscale_2_x = 0, 0, 0

    if plot_legend_list2 == ["Y", "Y", "Y", "Y"]:
        # print (
        #     '======TC======  ======wp=======  ======c======  ======wt======'
        # )
        world_pop_pslegend_x = 4.4
        cities_pslegend_x = 9.2
        wave_time_pslegend_x = 12.5

    elif plot_legend_list2 == ["N", "Y", "Y", "Y"]:
        # print (
        #     '       ======TC======  ======wp=======  ======c======         '
        # )
        tfp_cfz_pslegend_x = 1.4
        world_pop_pslegend_x = 6
        cities_pslegend_x = 11.5

    elif plot_legend_list2 == ["Y", "N", "Y", "Y"]:
        # print (
        #     '       ======TC======  ======c=======  ======wt======         '
        # )
        tfp_cfz_pslegend_x = 1.4
        cities_pslegend_x = 7
        wave_time_pslegend_x = 11

    elif plot_legend_list2 == ["Y", "Y", "N", "Y"]:
        # print (
        #     '       ======TC======  ======wp=======  ======wt======        '
        # )
        tfp_cfz_pslegend_x = 1.4
        world_pop_pslegend_x = 6
        wave_time_pslegend_x = 11

    elif plot_legend_list2 == ["Y", "Y", "Y", "N"]:
        # print (
        #     '       ======wp======  ======c=======  ======wt======         '
        # )
        world_pop_pslegend_x = 1.4
        cities_pslegend_x = 7
        wave_time_pslegend_x = 11
    elif plot_legend_list2 == ["N", "Y", "N", "Y"]:
        # print (
        #     '             ======TC======  ======wp=======                  '
        # )
        tfp_cfz_pslegend_x = 3.5
        world_pop_pslegend_x = 8.5

    elif plot_legend_list2 == ["N", "N", "Y", "Y"]:
        # print (
        #     '             ======TC======  ======c=======                  '
        # )
        tfp_cfz_pslegend_x = 3.5
        cities_pslegend_x = 9

    elif plot_legend_list2 == ["Y", "N", "N", "Y"]:
        # print (
        #     '             ======TC======  ======wt=======                  '
        # )
        tfp_cfz_pslegend_x = 3.5
        wave_time_pslegend_x = 9

    elif plot_legend_list2 == ["N", "Y", "Y", "N"]:
        # print (
        #     '             ======wp======  ======c=======                  '
        # )
        world_pop_pslegend_x = 3.5
        cities_pslegend_x = 9

    elif plot_legend_list2 == ["Y", "Y", "N", "N"]:
        # print (
        #     '             ======wp======  ======wt=======                  '
        # )
        world_pop_pslegend_x = 3.5
        wave_time_pslegend_x = 9

    elif plot_legend_list2 == ["Y", "N", "Y", "N"]:
        # print (
        #     '             ======c======  ======wt=======                  '
        # )
        cities_pslegend_x = 3.5
        wave_time_pslegend_x = 9

    elif plot_legend_list2 == ["N", "N", "N", "Y"]:
        # print (
        #     '                     ======TC======                       '
        # )
        tfp_cfz_pslegend_x = 6.5

    elif plot_legend_list2 == ["N", "Y", "N", "N"]:
        # print (
        #     '                     ======wp======                       '
        # )
        world_pop_pslegend_x = 6.3

    elif plot_legend_list2 == ["N", "N", "Y", "N"]:
        # print (
        #     '                     ======c======                       '
        # )
        cities_pslegend_x = 6.5

    elif plot_legend_list2 == ["Y", "N", "N", "N"]:
        # print (
        #     '                     ======wt======                       '
        # )
        wave_time_pslegend_x = 6.2

    world_pop_psscale_1_x = world_pop_pslegend_x
    world_pop_psscale_2_x = world_pop_psscale_1_x + 1.8

    tfp_cfz_psscale_1_x = tfp_cfz_pslegend_x
    tfp_cfz_psscale_2_x = tfp_cfz_psscale_1_x + 2.2

    return (
        world_pop_pslegend_x,
        world_pop_psscale_1_x,
        world_pop_psscale_2_x,
        cities_pslegend_x,
        wave_time_pslegend_x,
        tfp_cfz_pslegend_x,
        tfp_cfz_psscale_1_x,
        tfp_cfz_psscale_2_x,
    )


def calc_legend_positions(
        plot_legend_list, y_map_dist, plot_quake, quake_y_diff
):
    wave_height_pslegend_x, \
        wave_height_psscale_x, \
        wave_height_psscale_length = 0, 0, 0

    world_pop_pslegend_x, world_pop_psscale_1_x, world_pop_psscale_2_x = \
        0, 0, 0

    cities_pslegend_x = 0
    wave_time_pslegend_x = 0
    tfp_cfz_pslegend_x, tfp_cfz_psscale_1_x, tfp_cfz_psscale_2_x = 0, 0, 0

    if plot_quake == "Y":
        y_map_dist -= quake_y_diff

    # Y-Position der Legendbestandteile
    wave_height_pslegend_y = float(y_map_dist) - 1.55
    wave_height_psscale_y = float(y_map_dist) - 1.15
    wave_time_pslegend_y = float(y_map_dist) - 1.95
    world_pop_pslegend_y = float(y_map_dist) - 1.55
    world_pop_psscale_y = float(y_map_dist) - 1.75
    cities_pslegend_y = float(y_map_dist) - 2.49
    tfp_cfz_pslegend_y = float(y_map_dist) - 1.55
    tfp_cfz_psscale_y = float(y_map_dist) - 1.55

    # plot_legend_list = [
    #     plot_wave_height, plot_wave_time, world_pop,
    #     plot_cities, plot_cfz_tfp
    # ]
    if plot_legend_list == ["Y", "N", "N", "N", "N"]:
        # nur wave-height
        wave_height_pslegend_x = 6.6
        wave_height_psscale_x = 7.9
        wave_height_psscale_length = 13
    elif plot_legend_list == ["Y", "Y", "N", "N", "N"]:
        # nur wave-height und wave-time
        wave_height_pslegend_x = 4
        wave_height_psscale_x = 5.4
        wave_height_psscale_length = 8
        wave_time_pslegend_x = 11
    elif plot_legend_list == ["Y", "Y", "Y", "Y", "Y"]:
        # alles
        (
            world_pop_pslegend_x,
            world_pop_psscale_1_x,
            world_pop_psscale_2_x,
            cities_pslegend_x,
            wave_time_pslegend_x,
            tfp_cfz_pslegend_x,
            tfp_cfz_psscale_1_x,
            tfp_cfz_psscale_2_x,
        ) = calc_legend_for_wt_TC_wp_c(["Y", "N", "Y", "Y", "Y"])

        wave_height_pslegend_x = 4
        wave_height_psscale_x = 5.4
        wave_height_psscale_length = 8
        wave_time_pslegend_x = 11

        world_pop_pslegend_y -= 1.55
        world_pop_psscale_y -= 1.55
        cities_pslegend_y -= 1.55
        tfp_cfz_pslegend_y -= 1.55
        tfp_cfz_psscale_y -= 1.55
    elif (
            plot_legend_list[0] == "Y" and (
                plot_legend_list[1] == "Y"
                or plot_legend_list[2] == "Y"
                or plot_legend_list[3] == "Y"
                or plot_legend_list[4] == "Y"
            )
    ):
        # wave-height und alle anderen
        (
            world_pop_pslegend_x,
            world_pop_psscale_1_x,
            world_pop_psscale_2_x,
            cities_pslegend_x,
            wave_time_pslegend_x,
            tfp_cfz_pslegend_x,
            tfp_cfz_psscale_1_x,
            tfp_cfz_psscale_2_x,
        ) = calc_legend_for_wt_TC_wp_c(plot_legend_list)

        wave_height_pslegend_x = 6.6
        wave_height_psscale_x = 7.9
        wave_height_psscale_length = 13

        world_pop_pslegend_y -= 1.55
        world_pop_psscale_y -= 1.55
        cities_pslegend_y -= 1.55
        tfp_cfz_pslegend_y -= 1.55
        tfp_cfz_psscale_y -= 1.55
        wave_time_pslegend_y -= 1.55
    elif (
            plot_legend_list[0] == "N" and (
                plot_legend_list[1] == "Y"
                or plot_legend_list[2] == "Y"
                or plot_legend_list[3] == "Y"
                or plot_legend_list[4] == "Y"
            )
    ):
        # alles außer wave-height
        (
            world_pop_pslegend_x,
            world_pop_psscale_1_x,
            world_pop_psscale_2_x,
            cities_pslegend_x,
            wave_time_pslegend_x,
            tfp_cfz_pslegend_x,
            tfp_cfz_psscale_1_x,
            tfp_cfz_psscale_2_x,
        ) = calc_legend_for_wt_TC_wp_c(plot_legend_list)

    # erstellt die Positionen der Legendenbestandteile fuer gmt-script
    # Legend.sh
    wave_height_pslegend = "-Dx%sc/%sc/2.8c/1c/BL" % (
        wave_height_pslegend_x,
        wave_height_pslegend_y,
    )
    wave_height_psscale = "-D%sc/%sc/%sc/0.3ch" % (
        wave_height_psscale_x,
        wave_height_psscale_y,
        wave_height_psscale_length,
    )
    wave_time_pslegend = "-Dx%sc/%sc/4c/1c/BL" % (
        wave_time_pslegend_x,
        wave_time_pslegend_y,
    )

    world_pop_pslegend = "-Dx%sc/%sc/4c/1c/BL" % (
        world_pop_pslegend_x,
        world_pop_pslegend_y,
    )
    world_pop_psscale_1 = "-D%sc/%sc/-1.2c/0.35c" % (
        world_pop_psscale_1_x,
        world_pop_psscale_y,
    )
    world_pop_psscale_2 = "-D%sc/%sc/-1.2c/0.35c" % (
        world_pop_psscale_2_x,
        world_pop_psscale_y,
    )

    cities_pslegend = "-Dx%sc/%sc/6c/BL" % (
        cities_pslegend_x, cities_pslegend_y
    )

    tfp_cfz_pslegend = "-Dx%sc/%sc/0c/1/BL" % (
        tfp_cfz_pslegend_x, tfp_cfz_pslegend_y
    )
    tfp_cfz_psscale_1 = "-D%sc/%sc/-1.2/0.35c" % (
        tfp_cfz_psscale_1_x,
        (tfp_cfz_psscale_y - 0.2),
    )
    tfp_cfz_psscale_2 = "-D%sc/%sc/-0.8/0.35c" % (
        tfp_cfz_psscale_2_x,
        tfp_cfz_psscale_y,
    )

    return (
        wave_height_pslegend,
        wave_height_psscale,
        wave_time_pslegend,
        world_pop_pslegend,
        world_pop_psscale_1,
        world_pop_psscale_2,
        cities_pslegend,
        tfp_cfz_pslegend,
        tfp_cfz_psscale_1,
        tfp_cfz_psscale_2,
    )
