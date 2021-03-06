if (!window.JSON) {
    window.JSON = {
        stringify: function (vContent) {
            if (vContent instanceof Object) {
                var sOutput = "";
                if (vContent.constructor === Array) {
                    for (var nId = 0; nId < vContent.length; sOutput += this.stringify(vContent[nId]) + ",", nId++){};
                    return "[" + sOutput.substr(0, sOutput.length - 1) + "]";
                }
                if (vContent.toString !== Object.prototype.toString) { return "\"" + vContent.toString().replace(/"/g, "\\$&") + "\""; }
                for (var sProp in vContent) {
                    sOutput += "\"" + sProp.replace(/"/g, "\\$&") + "\":" + this.stringify(vContent[sProp]) + ",";
                }
                return "{" + sOutput.substr(0, sOutput.length - 1) + "}";
            }
            return typeof vContent === "string" ? "\"" + vContent.replace(/"/g, "\\$&") + "\"" : String(vContent);
        }
    };
}

$(function () {
    "use strict";
    var teams,
        display_names       = [],
        ids                 = [],
        current_individual = false,
        current_viewed_team = -1,
        team_list           = $("#team_list"),
        team_edit_pane      = $("#team_edit_pane"),
        team_member_inputs  = $(".team_member"),
        team_paid           = $("#paid"),
        team_participation  = $("#participation"),
        team_name           = $("#team_name"),
        team_new            = $("#new"),
        team_delete         = $("#delete"),
        team_individual     = $("#individual_checkbox"),
        indiv_hidden        = $(".hide_when_indiv"),
        indiv_shown         = $(".show_when_indiv");

    function move_editpane(id) {
        /*
         * Move the edit pane to the team at position (id)
         */
        
        //We save this for closure purposes
        var team = teams[id];

        if (id === current_viewed_team) {
            //If we're already here, toggle the edit pane instead
            if (team_edit_pane.css("display") !== "none") {
                edit();
                team_edit_pane.hide();
            }
            else team_edit_pane.show();
        }
        else {
            //Otherwise, move the edit pane, first setting the global current_viewed_team state
            current_viewed_team = id;
            
            //Remove the existing edit pane, and show the "new team" button if it is invisible
            team_delete.show();
            team_new.show();
            team_edit_pane.detach();

            //Update the edit pane fields
            team_name.val(team.name);
            team_member_inputs.each(function (index) {
                this.value = team.members[index];
            });
            team_paid.text(team.paid ? "Paid" : "Unpaid");
            team_participation.val(team.participation ? "On-Site" : "Online");
            
            //Update individuality
            current_individual = team.individual;
            team_individual.prop('checked', current_individual);
            if (!current_individual) {
                indiv_hidden.show();
                indiv_shown.hide();
            }
            else {
                indiv_hidden.hide();
                indiv_shown.show();
            } 

            //Reappend the edit pane where we want it, then make it visible
            display_names[id].after(team_edit_pane);
            team_edit_pane.show();
       }
    }

    function getID(obj) {
        /*
         * Get the ordinal id associated with DOM element obj
         */

        var i;
        for (i = 0; i < display_names.length; i += 1) {
            //Brute-force
            if (obj === display_names[i][0]) {
                return i;
            }
        }
    }

    function nameClick(event) {
        move_editpane(getID(event.target));
    }

    /*
     * Get the teams belonging to this user
     */
    $.ajax({
        url: "../wsgi-scripts/teams.py",
        method: "GET",
        data: {
            purpose: "list"
        },
        success: function (data) {
            var i, obj;
            teams = data.teams;

            // Generate the display names of the teams
            for (i = 0; i < teams.length; i += 1) {
                ids[i] = teams[i].id;
                obj = $("<div>").addClass("team").text(teams[i].name).click(nameClick);
                display_names.push(obj);
                team_list.append(obj);
            }
        }
    });

    function getData(purpose) {
        var name = team_name.val(),
            members = [],
            participation = "";
        team_member_inputs.each(function () {
            members.push(this.value);
        });
        participation = (team_participation.val() === "On-Site").toString();
        if (purpose === "edit") {
            return {
                "purpose": purpose,
                "id": ids[current_viewed_team],
                "name": name,
                "members": JSON.stringify(members),
                "participation": participation,
                "individual": team_individual.prop('checked') ? 'true' : 'false'
            };
        }
        return {
            "purpose": purpose,
            "name": name,
            "members": JSON.stringify(members),
            "participation": participation,
            "individual": team_individual.prop('checked') ? 'true' : 'false'
        };
    }

    function register() {
        var ret;
        ga('send', 'event', 'button', 'team');
        $.ajax({
            url: "../wsgi-scripts/teams.py",
            method: "POST",
            data: getData("register"),
            success: function (data) {
                ret = data.id;
            }
        });
        return ret;
    }

    function edit() {
        $.ajax({
            url: "../wsgi-scripts/teams.py",
            method: "POST",
            data: getData("edit")
        });
        teams[current_viewed_team].name = team_name.val();
        teams[current_viewed_team].members = members;
        teams[current_viewed_team].participation = team_participation.val() === "On-Site";
        teams[current_viewed_team].individual = team_individual.prop('checked');
        display_names[current_viewed_team].text(team_name.val());
    }

    function delete_team(team_id) {
        $.ajax({
            url: "../wsgi-scripts/teams.py",
            method: "POST",
            data: {
                purpose: "delete",
                id: ids[team_id]
            }
        });
    }


    $("#save").click(function () {
        var members = [], id, len = ids.length, obj;
        team_member_inputs.each(function () {
            members.push(this.value);
        });
        if (current_viewed_team === -1) {
            id = register();
            ids[len] = id;
            teams[len] = {
                id : id,
                name : team_name.val(),
                members : members,
                participation : team_participation.val() === "On-Site",
                paid: false
            };
            obj = $("<div>").addClass("team").text(teams[len].name).click(nameClick);
            display_names.push(obj);
            team_list.append(obj);
            team_new.show();
        } else {
            edit();
        }
        team_edit_pane.hide();
    });

    team_delete.click(function () {
        if (!confirm("Are you sure you want to delete this team?")) {
            return;
        }
        delete_team(current_viewed_team);
        delete teams[current_viewed_team];
        display_names[current_viewed_team].remove();
        display_names.splice(current_viewed_team, 1);
        team_edit_pane.hide();
    });

    $("#cancel").click(function () {
        team_new.show();
        team_edit_pane.hide();
    });

    team_individual.click(function() {
        current_individual = $(this).prop('checked');
        if (!current_individual) {
            indiv_hidden.show();
            indiv_shown.hide();
        }
        else {
            indiv_hidden.hide();
            indiv_shown.show();
        } 
    });

    team_new.click(function () {
        current_viewed_team = -1;
        current_individual = false;
        indiv_hidden.show();
        indiv_shown.hide();
        team_delete.hide();
        team_name.val("");
        team_member_inputs.each(function () {
            this.value = "";
        });
        team_paid.text("Unpaid");
        team_participation.val("On-Site");
        team_new.after(team_edit_pane);
        team_new.hide();
        team_edit_pane.show();
    });

    // Get the scores.
    $.getJSON("../wsgi-scripts/getscores.py", function (data) {
        var team, scores_el = $("#scores"), member, i, row, k, j, table;
        for (k = 0; k < data.length; k += 1) {
            team = data[k];
            table = $("<tbody>");
            // Display the team name
            scores_el.append($("<h2>").text(team.name));
            row = $("<tr>");
            // Empty first cell
            row.append($("<th>"));
            // Display the round name
            scores_el.append($("<h3>").text("Speed"));
            // Add the 25 speed round columns
            for (i = 1; i <= 25; i += 1) {
                row.append($("<th>").text(i));
            }
            row.append($("<th>").text("Speed Total"));
            table.append(row);
            for (j = 0; j < team.members.length; j += 1) {
                member = team.members[j];
                row = $("<tr>");
                row.append($("<td>").text(member.name));
                for (i = 1; i <= 25; i += 1) {
                    row.append($("<td>").text(+member.speed_scores[i]));
                }
                row.append($("<td>").text(member.speed_score));
                table.append(row);
            }
            scores_el.append($("<table>").append(table));

            table = $("<tbody>");
            // Display the round name
            scores_el.append($("<h3>").text("Accuracy"));
            row = $("<tr>");
            // Empty first cell
            row.append($("<th>"));
            for (i = 1; i <= 10; i += 1) {
                row.append($("<th>").text(i));
            }
            row.append($("<th>").text("Accuracy Total"));
            table.append(row);
            // Display the member names
            for (j = 0; j < team.members.length; j += 1) {
                member = team.members[j];
                row = $("<tr>");
                row.append($("<td>").text(member.name));
                for (i = 1; i <= 10; i += 1) {
                    row.append($("<td>").text(+member.accuracy_scores[i]));
                }
                row.append($("<td>").text(member.accuracy_score));
                table.append(row);
            }
            scores_el.append($("<table>").append(table));

            table = $("<tbody>");
            row = $("<tr>");
            scores_el.append($("<h3>").text("Team"));
            for (i = 1; i <= 10; i += 1) {
                row.append($("<th>").text(i));
            }
            row.append($("<th>").text("Team Total"));
            table.append(row);
            row = $("<tr>");
            for (i = 1; i <= 10; i += 1) {
                row.append($("<td>").text(+team.team_scores[i]));
            }
            row.append($("<td>").text(team.team_score));
            table.append(row);
            scores_el.append($("<table>").append(table));
            
            table = $("<tbody>");
            row = $("<tr>");
            scores_el.append($("<h3>").text("Guts"));
            for (i = 1; i <= 24; i += 1) {
                row.append($("<th>").text(i));
            }
            row.append($("<th>").text("Guts Total"));
            table.append(row);
            row = $("<tr>");
            for (i = 1; i <= 24; i += 1) {
                row.append($("<td>").text(+team.guts_scores[i]));
            }
            row.append($("<td>").text(team.guts_score));
            table.append(row);
            scores_el.append($("<table>").append(table));
        }
    });

    $.ajax({
        url: "../wsgi-scripts/checkemail.py",
        method: "GET",
        dataType: "json",
        success: function (data) {
            if (!data.success && data.error === 1) {
                $(".dialog").show();
                $(".cover").show();
                $("#dialog_submit").click(function () {
                    if ($("#dialog_input").val().indexOf("@") > -1) {
                        $.ajax({
                            url: "../wsgi-scripts/modify.py",
                            method: "POST",
                            data: {
                                "info": JSON.stringify({
                                    2: $("#dialog_input").val()
                                })
                            },
                            success: function () {
                                $(".dialog").hide();
                                $(".cover").hide();
                            }
                        });
                    } else {
                        $("#dialog_tip").text("Please enter a valid email.");
                    }
                });
            } else if (data.error === 0) {
                window.location.href= "login.shtml";
            }
        }
    });

    $(window).unload(edit);
});
