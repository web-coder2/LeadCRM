new Vue({
    el: '#ledorub-app',
    data: {
        newLead: {
            phone: '',
            name: '',
            comment: ''
        }
    },
    methods: {
        async createLead() {
            try {
                const response = await fetch('/leads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.newLead)
                });
                if (response.ok) {
                    alert('Lead created successfully!');
                    this.newLead.phone = '';
                    this.newLead.name = '';
                    this.newLead.comment = '';
                } else {
                    console.error('Failed to create lead:', response.status);
                    alert('Failed to create lead.');
                }
            } catch (error) {
                console.error('Error creating lead:', error);
                alert('Error creating lead.');
            }
        }
    }
});