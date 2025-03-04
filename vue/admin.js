new Vue({
    el: '#admin-app',
    data: {
        leads: []
    },
    mounted() {
        this.fetchLeads();
    },
    methods: {
        async fetchLeads() {
            const res = await fetch('/leads');
            this.leads = await res.json();
        },
        async updateLead(index) {
            try {
                const response = await fetch(`/leads/${index}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.leads[index])
                });
                if (response.ok) {
                    alert('Lead updated successfully!');
                    this.fetchLeads(); // Refresh the list
                } else {
                    console.error('Failed to update lead:', response.status);
                    alert('Failed to update lead.');
                }
            } catch (error) {
                console.error('Error updating lead:', error);
                alert('Error updating lead.');
            }
        },
        async deleteLead(index) {
            try {
                const response = await fetch(`/leads/${index}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    alert('Lead deleted successfully!');
                    this.fetchLeads(); // Refresh the list
                } else {
                    console.error('Failed to delete lead:', response.status);
                    alert('Failed to delete lead.');
                }
            } catch (error) {
                console.error('Error deleting lead:', error);
                alert('Error deleting lead.');
            }
        }
    }
});