angular.module("santedb").controller("EmrPatientPolicyController", ["$scope", "$timeout", "$rootScope", "$state", function($scope, $timeout, $rootScope, $state) {


    const existingElevator = SanteDB.authentication.getElevator();
    $scope.changePatientPolicies = async function(form) {
        if(form.$invalid) return;
        try {
            await SanteEMR.setPolicies(
                $scope.scopedObject, 
                $scope.scopedObject.policy.filter(p=>p.operation != BatchOperationType.Delete).map(o=>o.policyModel.oid),
                $scope.scopedObject.policy.filter(p=>p.operation == BatchOperationType.Delete).map(o=>o.policyModel.oid)
            );
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