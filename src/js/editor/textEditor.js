/**
 * Text Editor - Monaco Editor integration
 */

const TextEditor = {
  /**
   * Load Monaco Editor Library
   */
  async load() {
    return new Promise((resolve) => {
      require.config({
        paths: {
          vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs',
        },
      });

      require(['vs/editor/editor.main'], () => {
        // Define JSON theme
        monaco.editor.defineTheme('json-light', {
          base: 'vs',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#ffffff',
            'editorStickyScroll.background': '#eaeaea',
            'editorStickyScrollHover.background': '#e0e0e0',
            'editorStickyScroll.shadow': '#d0d0d0',
            'editorStickyScroll.border': '#cccccc',
          },
        });

        monaco.editor.defineTheme('json-dark', {
          base: 'vs-dark',
          inherit: true,
          rules: [],
          colors: {
            'editor.background': '#1e1e1e',
            'editorStickyScroll.background': '#2d2d30',
            'editorStickyScrollHover.background': '#3a3a3c',
            'editorStickyScroll.shadow': '#000000',
            'editorStickyScroll.border': '#454545',
          },
        });

        resolve();
      });
    });
  },

  /**
   * Get default JSON to show on load
   */
  getDefaultJson() {
    // Import embedded JSON to avoid CORS issues with file:// protocol
    return JSON.stringify(
      {
        company: {
          id: 'CORP-ECORP-001',
          name: 'E Corp (Evil Corp)',
          founded: '1984-06-10',
          active: true,
          revenue: 942000000000.0,
          employeeCount: 215000,
          headquarters: {
            address: {
              street: '1 World Trade Center',
              suite: 'Floors 90-105',
              city: 'New York',
              state: 'NY',
              zip: '10007',
              country: 'USA',
              coordinates: {
                lat: 40.7127,
                lng: -74.0134,
              },
            },
            phone: '+1-212-555-0100',
            email: 'contact@ecorp.com',
            website: 'https://www.ecorp.com',
          },
          offices: [
            {
              id: 'OFF-001',
              city: 'Washington D.C.',
              country: 'USA',
              employees: 3200,
              timezone: 'America/New_York',
            },
            {
              id: 'OFF-002',
              city: 'Shanghai',
              country: 'China',
              employees: 8400,
              timezone: 'Asia/Shanghai',
            },
            {
              id: 'OFF-003',
              city: 'London',
              country: 'UK',
              employees: 5100,
              timezone: 'Europe/London',
            },
            {
              id: 'OFF-004',
              city: 'Washington Township',
              country: 'USA',
              employees: 620,
              timezone: 'America/New_York',
              notes: 'Site of controversial nuclear facility and toxic waste cover-up',
            },
          ],
          socialMedia: {
            twitter: '@ECorp',
            linkedin: 'evil-corp-ecorp',
            github: 'ecorp-dev',
          },
        },
        departments: [
          {
            id: 'DEPT-001',
            name: 'Cybersecurity (via Allsafe)',
            head: 'EMP-1001',
            budget: 45000000,
            teams: [
              'Network Defense',
              'Incident Response',
              'Threat Intelligence',
              'Penetration Testing',
            ],
            headcount: 38,
          },
          {
            id: 'DEPT-002',
            name: 'Public Relations',
            head: 'EMP-1003',
            budget: 120000000,
            teams: ['Crisis Communications', 'Media Relations', 'Internal PR', 'Brand Strategy'],
            headcount: 210,
          },
          {
            id: 'DEPT-003',
            name: 'Executive Office',
            head: 'EMP-1007',
            budget: 300000000,
            teams: ['C-Suite', 'Legal', 'Compliance', 'Lobbying'],
            headcount: 52,
          },
          {
            id: 'DEPT-004',
            name: 'E Coin & Digital Finance',
            head: 'EMP-1008',
            budget: 890000000,
            teams: ['Blockchain Infrastructure', 'Consumer Banking', 'Monetary Policy'],
            headcount: 430,
          },
        ],
        employees: [
          {
            id: 'EMP-1001',
            firstName: 'Elliot',
            lastName: 'Alderson',
            email: 'elliot.alderson@allsafe.com',
            phone: '+1-646-555-0183',
            role: 'Senior Cybersecurity Engineer',
            department: 'DEPT-001',
            level: 'L4',
            startDate: '2013-04-15',
            salary: 87000,
            currency: 'USD',
            remote: false,
            skills: [
              'Network Penetration Testing',
              'Reverse Engineering',
              'Social Engineering',
              'Rootkit Development',
              'Kali Linux',
              'Metasploit',
              'Wireshark',
              'SQL Injection',
              'Dark Web OSINT',
            ],
            certifications: [
              {
                name: 'CEH - Certified Ethical Hacker',
                issuer: 'EC-Council',
                issuedDate: '2012-09-01',
                expiryDate: '2027-09-01',
              },
              {
                name: 'OSCP - Offensive Security Certified Professional',
                issuer: 'Offensive Security',
                issuedDate: '2013-02-14',
                expiryDate: null,
              },
            ],
            performance: {
              lastReview: '2015-03-10',
              rating: 4.9,
              goals: ['Monitor E Corp network 24/7', 'Reduce incident response time by 30%'],
              promotionEligible: true,
            },
            address: {
              city: 'New York',
              state: 'NY',
              zip: '10034',
              country: 'USA',
            },
            notes:
              'Extremely reclusive. Exceptional talent. Monitor for insider threat — possible DID diagnosis. Known morphine dependency.',
          },
          {
            id: 'EMP-1002',
            firstName: 'Darlene',
            lastName: 'Alderson',
            email: 'darlene.alderson@fsociety.net',
            phone: '+1-646-555-0294',
            role: 'Hacktivist / fsociety Co-Founder',
            department: null,
            level: null,
            startDate: '2015-01-01',
            salary: 0,
            currency: 'USD',
            remote: true,
            skills: [
              'Phishing Campaigns',
              'Malware Deployment',
              'Social Engineering',
              'OSINT',
              'Exploit Development',
            ],
            certifications: [],
            performance: {
              lastReview: null,
              rating: null,
              goals: ['Execute 5/9 Attack', 'Evade FBI surveillance'],
              promotionEligible: false,
            },
            address: {
              city: 'New York',
              state: 'NY',
              zip: '10002',
              country: 'USA',
            },
            notes: "FBI informant (coerced). Elliot Alderson's sister. Core fsociety operative.",
          },
          {
            id: 'EMP-1003',
            firstName: 'Angela',
            lastName: 'Moss',
            email: 'angela.moss@ecorp.com',
            phone: '+1-212-555-0371',
            role: 'Senior VP of Public Relations',
            department: 'DEPT-002',
            level: 'VP',
            startDate: '2015-06-01',
            salary: 240000,
            currency: 'USD',
            remote: false,
            skills: [
              'Crisis Communications',
              'Media Strategy',
              'Stakeholder Management',
              'Executive Presentations',
              'Regulatory Compliance',
            ],
            certifications: [],
            performance: {
              lastReview: '2016-01-05',
              rating: 4.5,
              goals: [
                'Rehabilitate E Corp post-hack public image',
                'Manage Washington Township lawsuit narrative',
              ],
              promotionEligible: true,
            },
            address: {
              city: 'New York',
              state: 'NY',
              zip: '10013',
              country: 'USA',
            },
            notes:
              'Mother died in Washington Township toxic leak. Initially investigated E Corp, later co-opted by Phillip Price. Ultimately manipulated by Whiterose. Deceased.',
          },
          {
            id: 'EMP-1004',
            firstName: 'Tyrell',
            lastName: 'Wellick',
            email: 'tyrell.wellick@ecorp.com',
            phone: '+1-212-555-0452',
            role: 'Senior Vice President of Technology / Acting CTO',
            department: 'DEPT-003',
            level: 'SVP',
            startDate: '2009-11-01',
            salary: 480000,
            currency: 'USD',
            remote: false,
            skills: [
              'Corporate Strategy',
              'Infrastructure Architecture',
              'Executive Manipulation',
              'Swedish / English / Mandarin',
              'Network Systems Design',
            ],
            certifications: [
              {
                name: 'MBA - Stockholm School of Economics',
                issuer: 'Stockholm School of Economics',
                issuedDate: '2005-06-01',
                expiryDate: null,
              },
            ],
            performance: {
              lastReview: '2015-04-20',
              rating: 4.8,
              goals: ['Secure CTO promotion', 'Oversee E Corp network modernization'],
              promotionEligible: true,
            },
            address: {
              city: 'New York',
              state: 'NY',
              zip: '10021',
              country: 'USA',
            },
            notes:
              'Narcissistic personality. Murdered Sharon Knowles under extreme stress. Used as Dark Army scapegoat post-5/9. Deceased — shot by Whiterose operative.',
          },
          {
            id: 'EMP-1005',
            firstName: 'Phillip',
            lastName: 'Price',
            email: 'phillip.price@ecorp.com',
            phone: '+1-212-555-0001',
            role: 'Chief Executive Officer',
            department: 'DEPT-003',
            level: 'C-Suite',
            startDate: '1997-03-01',
            salary: 28000000,
            currency: 'USD',
            remote: false,
            skills: [
              'Global Economic Strategy',
              'Political Lobbying',
              'Financial Instruments',
              'Corporate Governance',
              'Psychological Manipulation',
            ],
            certifications: [],
            performance: {
              lastReview: '2018-12-01',
              rating: 4.2,
              goals: ['Launch E Coin as global reserve currency', 'Maintain Deus Group influence'],
              promotionEligible: false,
            },
            address: {
              city: 'New York',
              state: 'NY',
              zip: '10065',
              country: 'USA',
            },
            notes:
              'Member of the Deus Group. Manipulated Angela Moss as a personal obsession. Killed by Whiterose after losing control of E Coin initiative. Deceased.',
          },
        ],
        products: [
          {
            id: 'PROD-001',
            name: 'E Coin',
            type: 'Cryptocurrency / Digital Currency',
            version: '2.1.0',
            status: 'active',
            launchDate: '2016-03-01',
            pricing: {
              model: 'market-based',
              tiers: [
                {
                  name: 'Consumer',
                  monthlyPrice: 0,
                  annualPrice: 0,
                  currency: 'USD',
                  features: [
                    'Digital wallet',
                    'Peer-to-peer transfers',
                    'E Corp merchant payments',
                  ],
                },
                {
                  name: 'Business',
                  monthlyPrice: 299,
                  annualPrice: 2870,
                  currency: 'USD',
                  features: [
                    'Bulk transactions',
                    'API integration',
                    'Priority settlement',
                    'Dedicated account manager',
                  ],
                },
                {
                  name: 'Government / Reserve',
                  monthlyPrice: null,
                  annualPrice: null,
                  currency: 'USD',
                  features: [
                    'Reserve currency integration',
                    'Custom monetary policy tools',
                    'Direct Fed liaison',
                    'Unlimited liquidity lines',
                  ],
                },
              ],
            },
            integrations: [
              'Federal Reserve System',
              'IMF',
              'Global Banking Networks',
              'E Corp Retail',
            ],
            metrics: {
              activeUsers: 214000000,
              monthlyActiveUsers: 189000000,
              churnRate: 0.008,
              npsScore: 34,
              uptime: 99.95,
            },
          },
        ],
      },
      null,
      2
    );
  },
};

// Export for use in other modules
window.TextEditor = TextEditor;
