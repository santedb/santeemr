angular.module("santedb").controller("EmrPatientPolicyController", ["$scope", "$timeout", "$rootScope", "$state", function($scope, $timeout, $rootScope, $state) {


    const existingElevator = SanteDB.authentication.getElevator();
    $scope.changePatientPolicies = function(form) {
        if(form.$invalid) return;
        var elevator = new SanteDBElevator(changePolicies, true);
        elevator.setCloseCallback(() => SanteDB.authentication.setElevator(existingElevator));
        SanteDB.authentication.setElevator(null);
        SanteDB.authentication.setElevator(elevator);
        changePolicies();
    }

    // change policies logic
    async function changePolicies() {
        try {
            await SanteDB.resources.entity.invokeOperationAsync($scope.scopedObject.id, "alter-policy", {
                cascadePolicies: true,
                add: $scope.scopedObject.policy.filter(p=>p.operation != BatchOperationType.Delete).map(o=>o.policyModel.oid),
                remove: $scope.scopedObject.policy.filter(p=>p.operation == BatchOperationType.Delete).map(o=>o.policyModel.oid)
            }, null, null, null, "application/json");
            SanteDB.authentication.setElevator(null);
            SanteDB.authentication.setElevator(existingElevator);

            $state.reload();
        }
        catch(e) {
            $rootScope.errorHandler(e);
        }
    }

    async function initializeView() {
        try {
            if(!$scope.scopedObject.policy) {
                $scope.scopedObject.policy = [];
                return;
            }
            const policies = await Promise.all($scope.scopedObject.policy.map((o) => SanteDB.resources.securityPolicy.getAsync(o.policy)));
            $timeout(() => {
                $scope.scopedObject.policy.forEach(p => {
                    p.policyModel = policies.find(o=>o.id == p.policy);
                });
            });
        }
        catch(e) {
            console.error(e);
        }
    }
    // We don't usually allow loading of policy info via the API so we need to load them here
    initializeView();
}]); 