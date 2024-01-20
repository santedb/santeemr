angular.module('santedb').controller("EmrUserIndexController", ["$scope", "$rootScope", function ($scope, $rootScope) {

    /**
    * @summary Delete the specified user
    */
    $scope.delete = async function (id, index) {
        if (id === SanteDB.authentication.SYSTEM_USER || id === SanteDB.authentication.ANONYMOUS_USER)
            alert(SanteDB.locale.getString("ui.emr.users.systemUser"));
        else {
            var data = $("#SecurityUserTable table").DataTable().row(index).data();
            if (!data.obsoletionTime && confirm(SanteDB.locale.getString("ui.emr.users.confirmDelete"))) {
                $("#action_grp_" + index + " a").addClass("disabled");
                $("#action_grp_" + index + " a i.fa-trash").removeClass("fa-trash").addClass("fa-circle-notch fa-spin");
                SanteDB.resources.securityUser.deleteAsync(id)
                    .then(function (e) {
                        $("#SecurityUserTable").attr("newQuery", true);
                        $("#SecurityUserTable table").DataTable().draw();
                    })
                    .catch($rootScope.errorHandler);
            }
            else if (data.obsoletionTime && confirm(SanteDB.locale.getString("ui.emr.users.confirmUnDelete"))) {
                $("#action_grp_" + index + " a").addClass("disabled");
                $("#action_grp_" + index + " a i.fa-trash-restore").removeClass("fa-trash-restore").addClass("fa-circle-notch fa-spin");

                // Patch the user
                var patch = new Patch({
                    change: [
                        new PatchOperation({
                            op: PatchOperationType.Remove,
                            path: 'obsoletionTime',
                            value: null
                        }),
                        new PatchOperation({
                            op: PatchOperationType.Remove,
                            path: 'obsoletedBy',
                            value: null
                        })
                    ]
                });

                SanteDB.resources.securityUser.patchAsync(id, data.securityStamp, patch)
                    .then(function (e) {
                        $("#SecurityUserTable").attr("newQuery", true);
                        $("#SecurityUserTable table").DataTable().draw();
                    })
                    .catch(function (e) {
                        $("#action_grp_" + index + " a").removeClass("disabled");
                        $("#action_grp_" + index + " a i.fa-circle-notch").removeClass("fa-circle-notch fa-spin").addClass("fa-trash-restore");
                        $rootScope.errorHandler(e);
                    });
            }
        }
    }

    /**
     * @summary Lock the specified user
     */
    $scope.lock = function (id, index) {
        if (id === SanteDB.authentication.SYSTEM_USER || id === SanteDB.authentication.ANONYMOUS_USER)
            alert(SanteDB.locale.getString("ui.emr.users.systemUser"));
        else {
            var data = $("#SecurityUserTable table").DataTable().row(index).data();
            if (confirm(SanteDB.locale.getString(data.lockout ? "ui.emr.users.confirmUnlock" : "ui.emr.users.confirmLock"))) {
                $("#action_grp_" + index + " a").addClass("disabled");
                $("#action_grp_" + index + " a i.fa-lock").removeClass("fa-lock").addClass("fa-circle-notch fa-spin");
                $("#action_grp_" + index + " a i.fa-unlock").removeClass("fa-unlock").addClass("fa-circle-notch fa-spin");
                if (data.lockout) {
                    SanteDB.resources.securityUser.unLockAsync(id)
                        .then(function (e) {
                            $("#SecurityUserTable table").DataTable().draw();
                        })
                        .catch($rootScope.errorHandler);
                }
                else {
                    SanteDB.resources.securityUser.lockAsync(id)
                        .then(function (e) {
                            $("#SecurityUserTable table").DataTable().draw();
                        })
                        .catch($rootScope.errorHandler);
                }
            }
        }
    }

    /**
     * @summary Reset password for the specified user
     */
    $scope.resetPassword = function (id, index) {
        if (id === SanteDB.authentication.SYSTEM_USER || id === SanteDB.authentication.ANONYMOUS_USER)
            alert(SanteDB.locale.getString("ui.emr.users.systemUser"));
        else {
            // Show wait
            $("#action_grp_" + index + " a").addClass("disabled");
            $(".btn-grp a i.fa-asterisk").addClass("disabled");
            $("#action_grp_" + index + " a i.fa-asterisk").removeClass("fa-asterisk").addClass("fa-circle-notch fa-spin");
            SanteDB.resources.securityUser.getAsync(id)
                .then(function (userData) {

                    $scope.password = userData;
                    $scope.password.passwordOnly = true;

                    $scope.$apply();
                    $("#passwordModal").modal();

                    // User has pressed save or cancelled
                    $("#passwordModal").on('hidden.bs.modal', function () {
                        $scope.password = null;
                        $("#SecurityUserTable table").DataTable().draw();
                    });

                })
                .catch($rootScope.errorHandler);
        }

    }

    /**
     * @summary Render the lockout status
     */
    $scope.renderLockout = function (user) {
        return user.obsoletionTime ? `<i title="${SanteDB.locale.getString("ui.state.obsolete")}" class="fa fa-trash"></i>  <span class="badge badge-pill badge-danger"> ${SanteDB.locale.getString("ui.state.obsolete")}</span>` :
            user.lockout > new Date() ? `<i title="${SanteDB.locale.getString("ui.state.locked")}" class="fa fa-lock"></i>  <span class="badge badge-pill badge-warning"> ${SanteDB.locale.getString("ui.state.locked")} (${moment(user.lockout).format(SanteDB.locale.dateFormats.second)})</span>` :
                `<i title="${SanteDB.locale.getString("ui.state.active")}" class="fa fa-check"></i> <span class="badge badge-pill badge-success"> ${SanteDB.locale.getString("ui.state.active")}</span>`;
    }

    /**
     * @summary Render the login status
     */
    $scope.renderLastLogin = function (user) {
        return !user.lastLoginTime ? "N/A" : moment(user.lastLoginTime).format("YYYY-MM-DD @ HH:mm:ss");
    }

}]);