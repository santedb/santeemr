angular.module('santedb').controller("EmrEditUserController", ["$scope", "$rootScope", "$stateParams", "$state", "$timeout", function ($scope, $rootScope, $stateParams, $state, $timeout) {

    /** Select a user for editing */
    async function initializeView(id) {
        try {
            var target = await SanteDB.resources.securityUser.getAsync(id);
            target.isAdmin = target.role.indexOf("LOCAL_ADMINISTRATORS") > -1;
            var userEntity = await SanteDB.resources.userEntity.findAsync({ securityUser: id, _viewModel: "full" });
            if (!userEntity.resource)
                target.userEntity = new UserEntity({
                    language: [
                        {
                            "languageCode": SanteDB.locale.getLanguage(),
                            "isPreferred": true
                        }
                    ],
                    securityUser: id
                });
            else
                target.userEntity = userEntity.resource[0];

            // Set language
            if (!target.userEntity.language)
                target.preferredLanguage = SanteDB.locale.getLanguage();
            else if (!Array.isArray(target.userEntity.language))
                target.preferredLanguage = target.userEntity.language.languageCode;
            else {
                var lng = target.userEntity.language.find(function (l) { return l.isPreferred; });
                if (!lng)
                    lng = { "languageCode": SanteDB.locale.getLanguage() };
                target.preferredLanguage = lng.languageCode;
            }
            $timeout(() => $scope.target = target);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    if($stateParams.id) {
        initializeView($stateParams.id);
    }
    else {
        $state.go("santedb-emr.system.users.index");
    }

}]).controller("EmrUserProfileWidgetController", ["$scope", "$rootScope", "$timeout", "$state", function($scope, $rootScope, $timeout, $state) {

    /**
     * @summary Reset password for the current
     */
    $scope.resetPassword = function (securityUser) {
        // Show wait
        SanteDB.display.buttonWait("#resetPasswordButton", true);

        // Setup password change request
        $scope.password = {
            id: securityUser.id,
            entity: {
                userName: securityUser.userName,
                id: securityUser.id,
                password: null
            },
            passwordOnly: true
        };
        $("#passwordModal").modal({ backdrop: 'static' });

        // User has pressed save or cancelled
        $("#passwordModal").on('hidden.bs.modal', function () {
            $scope.password = null;
            SanteDB.display.buttonWait("#resetPasswordButton", false);
        });

    }

    
    /**
     * @summary Reactivate Inactive User
     */
    $scope.reactivateUser = async function (securityUser) {
        if (!confirm(SanteDB.locale.getString("ui.emr.users.reactivate.confirm")))
            return;

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

        // Send the patch
        try {
            SanteDB.display.buttonWait("#reactivateUserButton", true);
            var updatedUser = await SanteDB.resources.securityUser.patchAsync(securityUser.id, securityUser.etag, patch)
            
            $timeout(() => {
                securityUser.obsoletionTime = null;
                securityUser.obsoletedBy = null;
            });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#reactivateUserButton", false);

        }

    }

    /**
     * @summary Reset invalid logins
     */
    $scope.resetInvalidLogins = async function (securityUser) {
        if (!confirm(SanteDB.locale.getString("ui.emr.users.invalidLogin.reset")))
            return;

        var patch = new Patch({
            change: [
                new PatchOperation({
                    op: PatchOperationType.Replace,
                    path: "invalidLoginAttempts",
                    value: 0
                })
            ]
        });

        try {
            SanteDB.display.buttonWait("#resetInvalidLoginButton", true);
            await SanteDB.resources.securityUser.patchAsync(securityUser.id, securityUser.etag, patch);
            $timeout(() => {
                securityUser.invalidLoginAttempts = 0;
            });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#resetInvalidLoginButton", false);
        }
    }

    /**
    * @summary Unlock user
    */
    $scope.unlock = async function (securityUser) {
        if (!confirm(SanteDB.locale.getString("ui.emr.users.confirmUnlock")))
            return;

        try {
            SanteDB.display.buttonWait("#unlockButton", true);
            await SanteDB.resources.securityUser.unLockAsync(securityUser.id);
            $timeout(() => securityUser.lockout = null);
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
        finally {
            SanteDB.display.buttonWait("#unlockButton", false);
        }
    }

    $scope.saveUser = async function(form) {
        if(form.$invalid) { return; }

        try {
            // Create submission
            var submission = {
                $type: "SecurityUserInfo",
                entity: $scope.editObject.entity,
                role: $scope.editObject.role
            };

            var result = await SanteDB.resources.securityUser.updateAsync($scope.editObject.entity.id, submission);
            toastr.success(SanteDB.locale.getString("ui.model.securityUser.saveSuccess"));
            $state.reload();
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    $scope.saveProfile = async function(form) {
        if(form.$invalid) return;

        try {

            await SanteDB.resources.userEntity.updateAsync($scope.editObject.userEntity.id, $scope.editObject.userEntity);
            toastr.success(SanteDB.locale.getString("ui.model.securityUser.saveSuccess"));
            //$state.reload();
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }
}]);