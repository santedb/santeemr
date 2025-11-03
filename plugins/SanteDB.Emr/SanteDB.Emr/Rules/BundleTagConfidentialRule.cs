using SanteDB;
using SanteDB.Core.Model.Acts;
using SanteDB.Core.Model.Collection;
using SanteDB.Core.Model.Constants;
using SanteDB.Core.Security;
using SanteDB.Core.Security.Services;
using SanteDB.Core.Services;
using SanteEMR.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SanteEMR.Rules
{
    /// <summary>
    /// Tag sensitive information as confidential
    /// </summary>
    public class BundleTagConfidentialRule : BaseBusinessRulesService<Bundle>
    {
        private readonly EmrConfigurationSection m_configuration;
        private readonly IConceptRepositoryService m_conceptRepository;
        private readonly IPolicyInformationService m_pipService;


        /// <summary>
        /// DI constructor
        /// </summary>
        public BundleTagConfidentialRule(IConceptRepositoryService conceptRepository, IConfigurationManager configurationManager, IPolicyInformationService pipService)
        {
            this.m_configuration = configurationManager.GetSection<EmrConfigurationSection>();
            this.m_conceptRepository = conceptRepository;
            this.m_pipService = pipService;
        }

        /// <summary>
        /// Tags any sensitive information in the payload with the indicated confidential policy tag
        /// </summary>
        public override Bundle BeforeInsert(Bundle data)
        {
            if (data == null)
            {
                throw new ArgumentNullException(nameof(data));
            }
            
            var policyMaps = this.m_configuration.AutoApplyPolicyMap.SelectMany(o => this.m_conceptRepository.ExpandConceptSet(o.ConceptSet).ToArray().Select(c => new { Concept = c.Key.Value, Policy = o.PolicyOid }))
                .GroupBy(o => o.Concept)
                .ToDictionaryIgnoringDuplicates(o => o.Key, o => o.Select(c => this.m_pipService.GetPolicy(c.Policy)).ToArray());



            // Process each act in the bundle 
            foreach (var act in data.Item.OfType<Act>().Where(o =>
                o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Ignore &&
                o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Delete &&
                o.StatusConceptKey == StatusKeys.Completed &&
                o.MoodConceptKey == ActMoodKeys.Eventoccurrence &&
                policyMaps.ContainsKey(o.TypeConceptKey.GetValueOrDefault())
                ).ToArray()
            )
            {
                // Apply policies
                var appliedPolicyMaps = policyMaps[act.TypeConceptKey.GetValueOrDefault()];
                act.Policies = act.Policies ?? new List<SanteDB.Core.Model.Security.SecurityPolicyInstance>(); // preserve user policies
                act.Policies.AddRange(appliedPolicyMaps.Where(p=>!act.Policies.Any(ap=>ap.PolicyKey == p.Key)).Select(o => new SanteDB.Core.Model.Security.SecurityPolicyInstance()
                {
                    PolicyKey = o.Key,
                    GrantType = SanteDB.Core.Model.Security.PolicyGrantType.Grant
                }));
            }
            return base.BeforeInsert(data);
        }


    }
}
